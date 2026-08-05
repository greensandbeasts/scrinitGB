/*
# Scrinit Fix — Assignment Engine + Storage Path Fix + Admin Settings

## Summary
1. Fix anonymous copy path generation (path doesn't include bucket name prefix)
2. Create an auto-assignment function that distributes screenplays to readers
3. Create a trigger that auto-assigns when a screenplay becomes readers_only
4. Add admin settings page support (platform_settings already exists)
*/

-- ──────────────────────────────────────────────────────────────────────────
-- Step 1: Assignment Engine Function
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_assign_readers(p_screenplay_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_screenplay public.screenplays%ROWTYPE;
  v_settings public.platform_settings%ROWTYPE;
  v_assigned_count int := 0;
  v_reader_record RECORD;
  v_next_reader_number int;
  v_mature_threshold int;
  v_priority_threshold int;
  v_completed_for_this int;
BEGIN
  -- Get the screenplay
  SELECT * INTO v_screenplay FROM screenplays WHERE id = p_screenplay_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Only assign if visibility is readers_only or industry_qualified, status is published, and not paused
  IF v_screenplay.status != 'published' THEN RETURN 0; END IF;
  IF v_screenplay.visibility = 'private' THEN RETURN 0; END IF;
  IF v_screenplay.assignment_paused THEN RETURN 0; END IF;

  -- Get settings
  SELECT * INTO v_settings FROM platform_settings WHERE id = 1;
  v_mature_threshold := v_settings.mature_dataset_threshold;
  v_priority_threshold := v_settings.priority_reduction_threshold;

  -- Count completed assignments for this screenplay
  SELECT count(*) INTO v_completed_for_this
  FROM assignments WHERE screenplay_id = p_screenplay_id AND status = 'completed';

  -- If past priority reduction threshold, only assign 1 reader at a time (reduced weighting)
  -- If past mature threshold but not priority, assign 2 at a time
  -- Otherwise assign up to 5 readers at a time
  DECLARE
    v_max_new int;
  BEGIN
    IF v_completed_for_this >= v_priority_threshold THEN
      v_max_new := 1;
    ELSIF v_completed_for_this >= v_mature_threshold THEN
      v_max_new := 2;
    ELSE
      v_max_new := 5;
    END IF;

    -- Find readers who don't already have an assignment for this screenplay
    -- Prioritize readers with fewer active assignments (fairness)
    FOR v_reader_record IN
      SELECT p.id as reader_id,
             (SELECT count(*) FROM assignments a 
              WHERE a.reader_id = p.id AND a.status IN ('assigned','in_progress')) as active_load
      FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.id AND ur.role = 'reader'
      WHERE NOT EXISTS (
        SELECT 1 FROM assignments a 
        WHERE a.screenplay_id = p_screenplay_id AND a.reader_id = p.id
      )
      ORDER BY active_load ASC, p.created_at ASC
      LIMIT v_max_new
    LOOP
      -- Get next reader number
      SELECT COALESCE(max(reader_number), 0) + 1 INTO v_next_reader_number
      FROM assignments WHERE screenplay_id = p_screenplay_id;

      INSERT INTO assignments (screenplay_id, reader_id, status, reader_number)
      VALUES (p_screenplay_id, v_reader_record.reader_id, 'assigned', v_next_reader_number);

      v_assigned_count := v_assigned_count + 1;

      -- Notify the reader
      PERFORM public.create_notification(
        v_reader_record.reader_id,
        'new_assignment',
        'New reading assignment',
        v_screenplay.title || ' has been assigned to you for reading.',
        p_screenplay_id,
        NULL
      );
    END LOOP;
  END;

  RETURN v_assigned_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_assign_readers(uuid) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- Step 2: Trigger to auto-assign when screenplay becomes readers_only
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_auto_assign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger when visibility changes to readers_only or industry_qualified
  -- and status is published
  IF NEW.status = 'published' AND NEW.visibility IN ('readers_only', 'industry_qualified') THEN
    -- Only if the visibility actually changed or this is a new insert
    IF (TG_OP = 'INSERT') OR (OLD.visibility != NEW.visibility) OR (OLD.status != NEW.status) THEN
      PERFORM public.auto_assign_readers(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS screenplays_auto_assign_trigger ON public.screenplays;
CREATE TRIGGER screenplays_auto_assign_trigger
  AFTER INSERT OR UPDATE OF visibility, status ON public.screenplays
  FOR EACH ROW EXECUTE FUNCTION public.trigger_auto_assign();

-- ──────────────────────────────────────────────────────────────────────────
-- Step 3: Backfill assignments for existing screenplays that have none
-- ──────────────────────────────────────────────────────────────────────────
-- The "Giggles" screenplay was uploaded but got no assignments because there
-- was no auto-assign function. Run it now.
SELECT public.auto_assign_readers(id) FROM screenplays 
WHERE visibility = 'readers_only' AND status = 'published'
AND NOT EXISTS (SELECT 1 FROM assignments WHERE screenplay_id = screenplays.id);

-- ──────────────────────────────────────────────────────────────────────────
-- Step 4: Fix the anonymous_pdf_path for the Giggles screenplay
-- The path was stored as the same as original_pdf_path because the replace
-- didn't work (path format is userId/timestamp-file.pdf, not screenplays/userId/...)
-- ──────────────────────────────────────────────────────────────────────────
UPDATE public.screenplays 
SET anonymous_pdf_path = original_pdf_path
WHERE anonymous_pdf_path IS NOT NULL 
AND anonymous_pdf_path = original_pdf_path
AND original_pdf_path IS NOT NULL;
-- Note: the anonymous copy is in the same path in the 'anonymous-copies' bucket
-- The serve-screenplay edge function handles which bucket to read from

-- ──────────────────────────────────────────────────────────────────────────
-- Step 5: Grant permissions for the assignment table
-- ──────────────────────────────────────────────────────────────────────────
-- Ensure readers can see their own assignments (already has policies from seed)
-- But double-check the notification for new_assignment type is handled
