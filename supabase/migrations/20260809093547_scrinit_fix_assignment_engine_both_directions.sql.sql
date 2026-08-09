/*
# Fix and improve reader assignment engine (both directions)

## Root causes identified and fixed:

### 1. trigger_auto_assign visibility mismatch (primary bug)
The trigger only fired for 'readers_only' and 'industry_qualified' visibility.
The frontend publishes screenplays with 'reader_community' visibility, so
screenplays published via the metadata page never triggered reader assignments.
Fix: include 'reader_community' in the trigger condition.

### 2. No new-reader assignment flow
When a user enabled the reader role, no function assigned existing screenplays
to them. New readers had to wait for a new screenplay to be uploaded.
Fix: new function assign_screenplays_to_reader + trigger on user_roles.

### 3. No genre preference or fair distribution
The assignment function picked readers purely by active load and creation date,
ignoring genre preferences and not balancing reads across screenplays.
Fix: rewritten auto_assign_readers with genre-priority + fair-distribution logic.

## Changes:

### platform_settings
- New column target_reads_per_screenplay (integer, default 12) — the target
  number of total reads (active + completed) each screenplay should converge
  towards. The assignment engine stops assigning once a screenplay reaches
  this count, ensuring fair distribution across all screenplays.

### auto_assign_readers(p_screenplay_id) — rewritten
- Now includes 'reader_community' visibility in eligibility check.
- Fair distribution: stops assigning once screenplay reaches
  target_reads_per_screenplay total (active + completed) reads.
- Genre preference: prefers readers whose preferred genres (from
  reader_profiles.reading_preferences->'genres') include the screenplay's
  genre or secondary_genre. Readers with no preferences match all genres.
- Falls back to any eligible reader if preferred-genre readers unavailable.
- Never assigns writer their own screenplay (writer_id check).
- No duplicate assignments (NOT EXISTS + unique constraint).
- Respects suspended readers and assignment_paused screenplays.
- Respects lifecycle_status = 'active' only.

### assign_screenplays_to_reader(p_reader_id) — new function
- Assigns existing eligible screenplays to a newly-enabled reader.
- Only assigns screenplays below target_reads_per_screenplay.
- Prioritizes under-read screenplays (lowest total reads first).
- Within suitable choices, prefers screenplays matching genre preferences.
- Falls back to any eligible screenplay if preferred genres unavailable.
- Never leaves an eligible reader without assignments due to genre mismatch.
- Assigns up to 5 screenplays.
- Same ownership, duplicate, and suspension safeguards as above.

### trigger_auto_assign — fixed
- Now fires for 'reader_community' visibility in addition to
  'readers_only' and 'industry_qualified'.
- Uses IS DISTINCT FROM for safe NULL handling on UPDATE comparisons.

### on_reader_role_added — new trigger on user_roles
- AFTER INSERT when role='reader', calls assign_screenplays_to_reader
  to immediately assign existing eligible screenplays to the new reader.

### on_assignment_status_change — new trigger on assignments
- AFTER UPDATE when status changes to 'abandoned' or 'expired',
  calls auto_assign_readers to create replacement assignments for
  the affected screenplay. The NOT EXISTS check in auto_assign_readers
  naturally excludes the reader who just cancelled.

### Backfill
- Runs auto_assign_readers for all existing published screenplays.
- Runs assign_screenplays_to_reader for all existing readers.
- Safe to re-run: NOT EXISTS checks and unique constraint prevent duplicates.

## Security
- All functions are SECURITY DEFINER with search_path TO 'public'.
- No RLS policies changed. No security weakening.
- Functions bypass RLS only to insert assignment rows (same as before).
*/

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Add target_reads_per_screenplay to platform_settings
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS target_reads_per_screenplay integer NOT NULL DEFAULT 12;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Rewrite auto_assign_readers with genre-priority + fair-distribution
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_assign_readers(p_screenplay_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_screenplay public.screenplays%ROWTYPE;
  v_settings public.platform_settings%ROWTYPE;
  v_assigned_count int := 0;
  v_reader_record RECORD;
  v_next_reader_number int;
  v_total_for_this int;
  v_target int;
  v_max_new int;
  v_completed_for_this int;
BEGIN
  SELECT * INTO v_screenplay FROM screenplays WHERE id = p_screenplay_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Eligibility: must be published, non-private, not paused, active lifecycle
  IF v_screenplay.status != 'published' THEN RETURN 0; END IF;
  IF v_screenplay.visibility NOT IN ('readers_only', 'industry_qualified', 'reader_community') THEN RETURN 0; END IF;
  IF COALESCE(v_screenplay.assignment_paused, false) THEN RETURN 0; END IF;
  IF v_screenplay.lifecycle_status != 'active' THEN RETURN 0; END IF;

  SELECT * INTO v_settings FROM platform_settings WHERE id = 1;
  v_target := v_settings.target_reads_per_screenplay;

  -- Count total active + completed assignments for this screenplay
  SELECT count(*) INTO v_total_for_this
  FROM assignments
  WHERE screenplay_id = p_screenplay_id
    AND status IN ('assigned', 'in_progress', 'completed');

  -- If already at or above target, no new assignments needed
  IF v_total_for_this >= v_target THEN RETURN 0; END IF;

  -- Determine max new assignments based on dataset maturity
  SELECT count(*) INTO v_completed_for_this
  FROM assignments WHERE screenplay_id = p_screenplay_id AND status = 'completed';

  IF v_completed_for_this >= v_settings.priority_reduction_threshold THEN
    v_max_new := 1;
  ELSIF v_completed_for_this >= v_settings.mature_dataset_threshold THEN
    v_max_new := 2;
  ELSE
    v_max_new := 5;
  END IF;

  -- Don't exceed target
  v_max_new := LEAST(v_max_new, v_target - v_total_for_this);
  IF v_max_new <= 0 THEN RETURN 0; END IF;

  -- Select eligible readers, preferring genre matches, then by lowest active load
  FOR v_reader_record IN
    SELECT
      p.id as reader_id,
      (SELECT count(*) FROM assignments a
       WHERE a.reader_id = p.id AND a.status IN ('assigned', 'in_progress')) as active_load,
      COALESCE(rp.reading_preferences->'genres', '[]'::jsonb) as pref_genres
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id AND ur.role = 'reader'
    LEFT JOIN reader_profiles rp ON rp.user_id = p.id
    WHERE p.id != v_screenplay.writer_id
      AND NOT EXISTS (
        SELECT 1 FROM assignments a
        WHERE a.screenplay_id = p_screenplay_id AND a.reader_id = p.id
      )
      AND NOT COALESCE(p.suspended, false)
    ORDER BY
      -- Genre preference as priority (0 = match, 1 = no match);
      -- readers with no preferences get 0 (match all)
      CASE
        WHEN COALESCE(jsonb_array_length(COALESCE(rp.reading_preferences->'genres', '[]'::jsonb)), 0) = 0 THEN 0
        WHEN COALESCE(rp.reading_preferences->'genres', '[]'::jsonb) @> to_jsonb(v_screenplay.genre) THEN 0
        WHEN v_screenplay.secondary_genre IS NOT NULL
             AND COALESCE(rp.reading_preferences->'genres', '[]'::jsonb) @> to_jsonb(v_screenplay.secondary_genre) THEN 0
        ELSE 1
      END,
      active_load ASC,
      p.created_at ASC
    LIMIT v_max_new
  LOOP
    SELECT COALESCE(max(reader_number), 0) + 1 INTO v_next_reader_number
    FROM assignments WHERE screenplay_id = p_screenplay_id;

    INSERT INTO assignments (screenplay_id, reader_id, status, reader_number)
    VALUES (p_screenplay_id, v_reader_record.reader_id, 'assigned', v_next_reader_number);

    v_assigned_count := v_assigned_count + 1;

    PERFORM public.create_notification(
      v_reader_record.reader_id, 'new_assignment', 'New reading assignment',
      v_screenplay.title || ' has been assigned to you for reading.',
      p_screenplay_id, NULL
    );
  END LOOP;

  RETURN v_assigned_count;
END;
$function$;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. New function: assign existing screenplays to a new reader
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.assign_screenplays_to_reader(p_reader_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_settings public.platform_settings%ROWTYPE;
  v_assigned_count int := 0;
  v_sp_record RECORD;
  v_next_reader_number int;
  v_pref_genres jsonb;
  v_target int;
  v_reader_profile public.profiles%ROWTYPE;
BEGIN
  -- Validate reader exists, is not suspended, and has the reader role
  SELECT * INTO v_reader_profile FROM profiles WHERE id = p_reader_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF COALESCE(v_reader_profile.suspended, false) THEN RETURN 0; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = p_reader_id AND role = 'reader'
  ) THEN
    RETURN 0;
  END IF;

  SELECT * INTO v_settings FROM platform_settings WHERE id = 1;
  v_target := v_settings.target_reads_per_screenplay;

  -- Get reader's genre preferences (empty array if none set)
  SELECT COALESCE(rp.reading_preferences->'genres', '[]'::jsonb)
  INTO v_pref_genres
  FROM reader_profiles rp WHERE rp.user_id = p_reader_id;
  IF v_pref_genres IS NULL THEN v_pref_genres := '[]'::jsonb; END IF;

  -- Select eligible screenplays: published, non-private, not paused, active,
  -- not owned by this reader, not already assigned to this reader, under target.
  -- Order by genre match first, then by lowest read count (fair distribution).
  FOR v_sp_record IN
    SELECT
      sp.id as screenplay_id,
      sp.title,
      sp.genre,
      sp.secondary_genre,
      (SELECT count(*) FROM assignments a
       WHERE a.screenplay_id = sp.id
         AND a.status IN ('assigned', 'in_progress', 'completed')) as total_reads
    FROM screenplays sp
    WHERE sp.status = 'published'
      AND sp.visibility IN ('readers_only', 'industry_qualified', 'reader_community')
      AND NOT COALESCE(sp.assignment_paused, false)
      AND sp.lifecycle_status = 'active'
      AND sp.writer_id != p_reader_id
      AND NOT EXISTS (
        SELECT 1 FROM assignments a
        WHERE a.screenplay_id = sp.id AND a.reader_id = p_reader_id
      )
      AND (
        SELECT count(*) FROM assignments a
        WHERE a.screenplay_id = sp.id
          AND a.status IN ('assigned', 'in_progress', 'completed')
      ) < v_target
    ORDER BY
      -- Genre preference as priority (0 = match or no preferences, 1 = no match)
      CASE
        WHEN COALESCE(jsonb_array_length(v_pref_genres), 0) = 0 THEN 0
        WHEN v_pref_genres @> to_jsonb(sp.genre) THEN 0
        WHEN sp.secondary_genre IS NOT NULL AND v_pref_genres @> to_jsonb(sp.secondary_genre) THEN 0
        ELSE 1
      END,
      -- Fair distribution: under-read screenplays first
      total_reads ASC,
      sp.published_at DESC
    LIMIT 5
  LOOP
    SELECT COALESCE(max(reader_number), 0) + 1 INTO v_next_reader_number
    FROM assignments WHERE screenplay_id = v_sp_record.screenplay_id;

    INSERT INTO assignments (screenplay_id, reader_id, status, reader_number)
    VALUES (v_sp_record.screenplay_id, p_reader_id, 'assigned', v_next_reader_number);

    v_assigned_count := v_assigned_count + 1;

    PERFORM public.create_notification(
      p_reader_id, 'new_assignment', 'New reading assignment',
      v_sp_record.title || ' has been assigned to you for reading.',
      v_sp_record.screenplay_id, NULL
    );
  END LOOP;

  RETURN v_assigned_count;
END;
$function$;

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Fix trigger_auto_assign to include 'reader_community' visibility
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_auto_assign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Fire when screenplay becomes published with any reader-visible visibility
  IF NEW.status = 'published'
     AND NEW.visibility IN ('readers_only', 'industry_qualified', 'reader_community')
  THEN
    -- Only trigger on actual visibility/status change or new insert
    IF TG_OP = 'INSERT'
       OR OLD.visibility IS DISTINCT FROM NEW.visibility
       OR OLD.status IS DISTINCT FROM NEW.status
    THEN
      PERFORM public.auto_assign_readers(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- ──────────────────────────────────────────────────────────────────────────
-- 5. New trigger on user_roles: assign screenplays when reader role is added
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.on_reader_role_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role = 'reader' THEN
    PERFORM public.assign_screenplays_to_reader(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS user_roles_reader_assignment ON public.user_roles;
CREATE TRIGGER user_roles_reader_assignment
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION on_reader_role_added();

-- ──────────────────────────────────────────────────────────────────────────
-- 6. New trigger on assignments: create replacement when assignment cancelled
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.on_assignment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- When an assignment is abandoned or expires, create a replacement
  IF NEW.status IN ('abandoned', 'expired')
     AND OLD.status IS DISTINCT FROM NEW.status
  THEN
    PERFORM public.auto_assign_readers(NEW.screenplay_id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS assignment_replacement_trigger ON public.assignments;
CREATE TRIGGER assignment_replacement_trigger
  AFTER UPDATE OF status ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION on_assignment_status_change();

-- ──────────────────────────────────────────────────────────────────────────
-- 7. Backfill: assign readers for all existing published screenplays and
--    assign screenplays to all existing readers
-- ──────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  sp RECORD;
  r RECORD;
BEGIN
  -- Assign readers to existing eligible screenplays
  FOR sp IN
    SELECT id FROM screenplays
    WHERE status = 'published'
      AND visibility IN ('readers_only', 'industry_qualified', 'reader_community')
      AND NOT COALESCE(assignment_paused, false)
      AND lifecycle_status = 'active'
  LOOP
    PERFORM auto_assign_readers(sp.id);
  END LOOP;

  -- Assign screenplays to existing readers
  FOR r IN
    SELECT user_id FROM user_roles WHERE role = 'reader'
  LOOP
    PERFORM assign_screenplays_to_reader(r.user_id);
  END LOOP;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 8. Composite index for efficient read-count queries
-- ──────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_assignments_screenplay_active
  ON public.assignments (screenplay_id)
  WHERE status IN ('assigned', 'in_progress', 'completed');

CREATE INDEX IF NOT EXISTS idx_assignments_reader_active
  ON public.assignments (reader_id)
  WHERE status IN ('assigned', 'in_progress');
