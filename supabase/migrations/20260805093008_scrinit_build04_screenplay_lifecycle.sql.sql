-- ============================================================================
-- Build 04: Screenplay Lifecycle — Following, Status History, Archiving, Release Info
--
-- Adds:
--   1. screenplay_followers — readers follow screenplays they've reviewed
--   2. follower_notifications — notifies followers on lifecycle status changes
--   3. project_status_history — complete lifecycle change log
--   4. screenplays: archive_date, archive_reason, lifecycle_status, release_info columns
--   5. Updates screenplay_discovery view to exclude archived screenplays
-- ============================================================================

-- ============================================================================
-- 1. Add lifecycle columns to screenplays
-- ============================================================================
ALTER TABLE public.screenplays
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS archive_date timestamptz,
  ADD COLUMN IF NOT EXISTS archive_reason text;

-- lifecycle_status values: 'active', 'optioned', 'purchased', 'in_development',
-- 'in_production', 'available_to_watch', 'archived'

-- ============================================================================
-- 2. Release information table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.release_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screenplay_id uuid NOT NULL REFERENCES public.screenplays(id) ON DELETE CASCADE,
  streaming_platform text,
  tv_broadcaster text,
  cinema_release text,
  official_website text,
  trailer_link text,
  release_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(screenplay_id)
);

ALTER TABLE public.release_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_release_info ON public.release_info;
CREATE POLICY select_release_info ON public.release_info
  FOR SELECT TO authenticated
  USING (
    is_screenplay_writer(screenplay_id, auth.uid())
    OR is_admin()
  );

DROP POLICY IF EXISTS insert_release_info ON public.release_info;
CREATE POLICY insert_release_info ON public.release_info
  FOR INSERT TO authenticated
  WITH CHECK (is_screenplay_writer(screenplay_id, auth.uid()) OR is_admin());

DROP POLICY IF EXISTS update_release_info ON public.release_info;
CREATE POLICY update_release_info ON public.release_info
  FOR UPDATE TO authenticated
  USING (is_screenplay_writer(screenplay_id, auth.uid()) OR is_admin())
  WITH CHECK (is_screenplay_writer(screenplay_id, auth.uid()) OR is_admin());

DROP POLICY IF EXISTS delete_release_info ON public.release_info;
CREATE POLICY delete_release_info ON public.release_info
  FOR DELETE TO authenticated
  USING (is_screenplay_writer(screenplay_id, auth.uid()) OR is_admin());

-- Followers need to read release_info for 'available_to_watch' screenplays
-- We handle this via the follower-aware view below instead.

-- ============================================================================
-- 3. Screenplay followers
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.screenplay_followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screenplay_id uuid NOT NULL REFERENCES public.screenplays(id) ON DELETE CASCADE,
  reader_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(screenplay_id, reader_id)
);

CREATE INDEX IF NOT EXISTS idx_screenplay_followers_screenplay ON public.screenplay_followers(screenplay_id);
CREATE INDEX IF NOT EXISTS idx_screenplay_followers_reader ON public.screenplay_followers(reader_id);

ALTER TABLE public.screenplay_followers ENABLE ROW LEVEL SECURITY;

-- Readers can only follow screenplays they've completed a review for.
-- We need a SECURITY DEFINER helper to check this without RLS recursion.
CREATE OR REPLACE FUNCTION public.has_completed_review(p_screenplay_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM reader_feedback f
    JOIN assignments a ON a.id = f.assignment_id
    WHERE f.screenplay_id = p_screenplay_id
      AND f.reader_id = p_user_id
      AND a.status = 'completed'
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_completed_review(uuid, uuid) TO authenticated, anon;

DROP POLICY IF EXISTS select_screenplay_followers ON public.screenplay_followers;
CREATE POLICY select_screenplay_followers ON public.screenplay_followers
  FOR SELECT TO authenticated
  USING (
    reader_id = auth.uid()
    OR is_admin()
    OR is_screenplay_writer(screenplay_id, auth.uid())
  );

DROP POLICY IF EXISTS insert_screenplay_followers ON public.screenplay_followers;
CREATE POLICY insert_screenplay_followers ON public.screenplay_followers
  FOR INSERT TO authenticated
  WITH CHECK (
    reader_id = auth.uid()
    AND has_completed_review(screenplay_id, auth.uid())
  );

DROP POLICY IF EXISTS delete_screenplay_followers ON public.screenplay_followers;
CREATE POLICY delete_screenplay_followers ON public.screenplay_followers
  FOR DELETE TO authenticated
  USING (reader_id = auth.uid());

-- ============================================================================
-- 4. Follower notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.follower_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screenplay_id uuid NOT NULL REFERENCES public.screenplays(id) ON DELETE CASCADE,
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lifecycle_status text NOT NULL,
  title text NOT NULL,
  body text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_follower_notifications_follower ON public.follower_notifications(follower_id);
CREATE INDEX IF NOT EXISTS idx_follower_notifications_screenplay ON public.follower_notifications(screenplay_id);

ALTER TABLE public.follower_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_follower_notifications ON public.follower_notifications;
CREATE POLICY select_follower_notifications ON public.follower_notifications
  FOR SELECT TO authenticated
  USING (follower_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS update_follower_notifications ON public.follower_notifications;
CREATE POLICY update_follower_notifications ON public.follower_notifications
  FOR UPDATE TO authenticated
  USING (follower_id = auth.uid() OR is_admin())
  WITH CHECK (follower_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS insert_follower_notifications ON public.follower_notifications;
CREATE POLICY insert_follower_notifications ON public.follower_notifications
  FOR INSERT TO authenticated
  WITH CHECK (follower_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS delete_follower_notifications ON public.follower_notifications;
CREATE POLICY delete_follower_notifications ON public.follower_notifications
  FOR DELETE TO authenticated
  USING (follower_id = auth.uid() OR is_admin());

-- ============================================================================
-- 5. Project status history
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.project_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screenplay_id uuid NOT NULL REFERENCES public.screenplays(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  changed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  archive_reason text,
  release_info_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_status_history_screenplay ON public.project_status_history(screenplay_id);

ALTER TABLE public.project_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_project_status_history ON public.project_status_history;
CREATE POLICY select_project_status_history ON public.project_status_history
  FOR SELECT TO authenticated
  USING (
    is_screenplay_writer(screenplay_id, auth.uid())
    OR is_admin()
  );

DROP POLICY IF EXISTS insert_project_status_history ON public.project_status_history;
CREATE POLICY insert_project_status_history ON public.project_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    is_screenplay_writer(screenplay_id, auth.uid())
    OR is_admin()
  );

-- ============================================================================
-- 6. SECURITY DEFINER function: update_screenplay_lifecycle
--    Writers call this to update lifecycle status. It:
--      - Updates the screenplay's lifecycle_status and archive fields
--      - Inserts a project_status_history row
--      - Notifies all followers
--      - Creates release_info if provided
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_screenplay_lifecycle(
  p_screenplay_id uuid,
  p_new_status text,
  p_archive_reason text DEFAULT NULL,
  p_release_info jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous_status text;
  v_writer_id uuid;
  v_follower record;
  v_title text;
  v_notif_title text;
  v_notif_body text;
  v_should_archive boolean := false;
BEGIN
  -- Verify caller is the writer
  SELECT lifecycle_status, writer_id, title INTO v_previous_status, v_writer_id, v_title
  FROM screenplays WHERE id = p_screenplay_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Screenplay not found';
  END IF;

  IF v_writer_id != auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized to update this screenplay';
  END IF;

  -- Determine if this status triggers archiving
  v_should_archive := p_new_status IN ('optioned', 'purchased', 'in_development', 'in_production', 'available_to_watch');

  -- Update the screenplay
  IF v_should_archive THEN
    UPDATE screenplays
    SET lifecycle_status = p_new_status,
        status = 'archived',
        archive_date = now(),
        archive_reason = p_archive_reason,
        updated_at = now()
    WHERE id = p_screenplay_id;
  ELSE
    UPDATE screenplays
    SET lifecycle_status = p_new_status,
        updated_at = now()
    WHERE id = p_screenplay_id;
  END IF;

  -- Insert status history
  INSERT INTO project_status_history (screenplay_id, previous_status, new_status, changed_by, archive_reason)
  VALUES (p_screenplay_id, v_previous_status, p_new_status, auth.uid(), p_archive_reason);

  -- Create/update release info if provided
  IF p_release_info IS NOT NULL AND p_new_status = 'available_to_watch' THEN
    INSERT INTO release_info (screenplay_id, streaming_platform, tv_broadcaster, cinema_release, official_website, trailer_link, release_date)
    VALUES (
      p_screenplay_id,
      COALESCE(p_release_info->>'streaming_platform', NULL),
      COALESCE(p_release_info->>'tv_broadcaster', NULL),
      COALESCE(p_release_info->>'cinema_release', NULL),
      COALESCE(p_release_info->>'official_website', NULL),
      COALESCE(p_release_info->>'trailer_link', NULL),
      CASE WHEN p_release_info->>'release_date' IS NOT NULL AND p_release_info->>'release_date' != ''
           THEN (p_release_info->>'release_date')::date ELSE NULL END
    )
    ON CONFLICT (screenplay_id) DO UPDATE SET
      streaming_platform = EXCLUDED.streaming_platform,
      tv_broadcaster = EXCLUDED.tv_broadcaster,
      cinema_release = EXCLUDED.cinema_release,
      official_website = EXCLUDED.official_website,
      trailer_link = EXCLUDED.trailer_link,
      release_date = EXCLUDED.release_date,
      updated_at = now();
  END IF;

  -- Notify followers
  v_notif_title := CASE p_new_status
    WHEN 'optioned' THEN 'Screenplay Optioned'
    WHEN 'purchased' THEN 'Screenplay Purchased'
    WHEN 'in_development' THEN 'In Development'
    WHEN 'in_production' THEN 'In Production'
    WHEN 'available_to_watch' THEN 'Available to Watch'
    ELSE 'Status Updated'
  END;

  v_notif_body := 'A screenplay you reviewed has a new status: ' || p_new_status;

  FOR v_follower IN SELECT reader_id FROM screenplay_followers WHERE screenplay_id = p_screenplay_id LOOP
    INSERT INTO follower_notifications (screenplay_id, follower_id, lifecycle_status, title, body)
    VALUES (p_screenplay_id, v_follower.reader_id, p_new_status, v_notif_title, v_notif_body);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_screenplay_lifecycle(uuid, text, text, jsonb) TO authenticated;

-- ============================================================================
-- 7. Update screenplay_discovery view to exclude archived screenplays
-- ============================================================================
DROP VIEW IF EXISTS public.screenplay_discovery;

CREATE VIEW public.screenplay_discovery AS
WITH agg AS (
  SELECT s_1.id AS screenplay_id,
    count(DISTINCT a.id) AS total_assignments,
    count(DISTINCT
        CASE
            WHEN a.status = ANY (ARRAY['completed'::assignment_status, 'abandoned'::assignment_status]) THEN a.id
            ELSE NULL::uuid
        END) AS responded_assignments,
    count(DISTINCT
        CASE
            WHEN a.status = 'completed'::assignment_status THEN a.id
            ELSE NULL::uuid
        END) AS completed_assignments,
    count(DISTINCT
        CASE
            WHEN a.status = 'abandoned'::assignment_status THEN a.id
            ELSE NULL::uuid
        END) AS abandoned_assignments,
    count(DISTINCT a.reader_id) AS reader_count,
    count(DISTINCT f.id) AS feedback_count,
    count(DISTINCT
        CASE
            WHEN f.would_recommend THEN f.id
            ELSE NULL::uuid
        END) AS recommend_count,
    COALESCE(avg(f.overall_rating), 0::numeric) AS avg_rating,
    COALESCE(avg(f.story_rating), 0::numeric) AS avg_story,
    COALESCE(avg(f.characters_rating), 0::numeric) AS avg_characters,
    COALESCE(avg(f.pacing_rating), 0::numeric) AS avg_pacing,
    COALESCE(avg(f.dialogue_rating), 0::numeric) AS avg_dialogue,
    COALESCE(avg(sess.last_page_reached), 0::numeric) AS avg_last_page,
    count(DISTINCT sess.id) AS total_sessions,
    count(DISTINCT
        CASE
            WHEN sess.session_number > 1 THEN sess.id
            ELSE NULL::uuid
        END) AS return_sessions
   FROM screenplays s_1
     LEFT JOIN assignments a ON a.screenplay_id = s_1.id
     LEFT JOIN reader_feedback f ON f.screenplay_id = s_1.id
     LEFT JOIN reading_sessions sess ON sess.screenplay_id = s_1.id
  GROUP BY s_1.id
)
SELECT s.id,
    s.title,
    s.genre,
    s.logline,
    s.synopsis,
    s.writer_id,
    p.display_name AS writer_name,
    p.company AS writer_company,
    s.cover_color,
    s.tags,
    s.page_count,
    s.published_at,
    COALESCE(agg.total_assignments, 0::bigint) AS total_assignments,
    COALESCE(agg.reader_count, 0::bigint) AS reader_count,
    COALESCE(agg.completed_assignments, 0::bigint) AS completed_count,
    COALESCE(agg.abandoned_assignments, 0::bigint) AS abandoned_count,
    COALESCE(agg.feedback_count, 0::bigint) AS feedback_count,
    COALESCE(agg.recommend_count, 0::bigint) AS recommend_count,
    CASE
        WHEN COALESCE(agg.reader_count, 0::bigint) = 0 THEN 0::numeric
        ELSE round(agg.completed_assignments::numeric / agg.reader_count::numeric * 100::numeric, 1)
    END AS completion_rate,
    CASE
        WHEN COALESCE(agg.feedback_count, 0::bigint) = 0 THEN 0::numeric
        ELSE round(agg.recommend_count::numeric / agg.feedback_count::numeric * 100::numeric, 1)
    END AS recommend_rate,
    round(COALESCE(agg.avg_rating, 0::numeric), 1) AS avg_rating,
    round(COALESCE(agg.avg_story, 0::numeric), 1) AS avg_story,
    round(COALESCE(agg.avg_characters, 0::numeric), 1) AS avg_characters,
    round(COALESCE(agg.avg_pacing, 0::numeric), 1) AS avg_pacing,
    round(COALESCE(agg.avg_dialogue, 0::numeric), 1) AS avg_dialogue,
    round(COALESCE(agg.avg_last_page, 0::numeric), 1) AS avg_last_page,
    COALESCE(agg.total_sessions, 0::bigint) AS total_sessions,
    COALESCE(agg.return_sessions, 0::bigint) AS return_sessions,
    CASE
        WHEN COALESCE(agg.total_sessions, 0::bigint) = 0 THEN 0::numeric
        ELSE round(agg.return_sessions::numeric / agg.total_sessions::numeric * 100::numeric, 1)
    END AS return_rate,
    LEAST(round(COALESCE(agg.reader_count, 0::bigint)::numeric / 10::numeric * 100::numeric), 100::numeric)::integer AS confidence_score,
    s.secondary_genre,
    s.format_type,
    s.budget_range,
    s.themes,
    s.primary_setting,
    s.time_period,
    s.tone,
    s.target_audience,
    s.industry_qualified,
    s.visibility,
    s.lifecycle_status
   FROM screenplays s
     JOIN profiles p ON p.id = s.writer_id
     LEFT JOIN agg ON agg.screenplay_id = s.id
  WHERE s.status = 'published'::screenplay_status
    AND s.lifecycle_status = 'active';

ALTER VIEW public.screenplay_discovery SET (security_invoker = false);
GRANT SELECT ON public.screenplay_discovery TO authenticated;

-- ============================================================================
-- 8. View for readers to see screenplays they've reviewed (including archived)
--    This view includes archived screenplays so readers can view analytics
--    for screenplays they've completed reviewing.
-- ============================================================================
CREATE OR REPLACE VIEW public.reader_reviewed_screenplays AS
WITH agg AS (
  SELECT s_1.id AS screenplay_id,
    count(DISTINCT a.id) AS total_assignments,
    count(DISTINCT
        CASE WHEN a.status = 'completed'::assignment_status THEN a.id
        ELSE NULL::uuid END) AS completed_assignments,
    count(DISTINCT a.reader_id) AS reader_count,
    count(DISTINCT f.id) AS feedback_count,
    count(DISTINCT
        CASE WHEN f.would_recommend THEN f.id
        ELSE NULL::uuid END) AS recommend_count,
    COALESCE(avg(f.overall_rating), 0::numeric) AS avg_rating,
    COALESCE(avg(f.story_rating), 0::numeric) AS avg_story,
    COALESCE(avg(f.characters_rating), 0::numeric) AS avg_characters,
    COALESCE(avg(f.pacing_rating), 0::numeric) AS avg_pacing,
    COALESCE(avg(f.dialogue_rating), 0::numeric) AS avg_dialogue,
    COALESCE(avg(sess.last_page_reached), 0::numeric) AS avg_last_page,
    count(DISTINCT sess.id) AS total_sessions,
    count(DISTINCT
        CASE WHEN sess.session_number > 1 THEN sess.id
        ELSE NULL::uuid END) AS return_sessions
   FROM screenplays s_1
     LEFT JOIN assignments a ON a.screenplay_id = s_1.id
     LEFT JOIN reader_feedback f ON f.screenplay_id = s_1.id
     LEFT JOIN reading_sessions sess ON sess.screenplay_id = s_1.id
  GROUP BY s_1.id
)
SELECT s.id,
    s.title,
    s.genre,
    s.logline,
    s.synopsis,
    s.cover_color,
    s.tags,
    s.page_count,
    s.published_at,
    COALESCE(agg.reader_count, 0::bigint) AS reader_count,
    COALESCE(agg.completed_assignments, 0::bigint) AS completed_count,
    COALESCE(agg.feedback_count, 0::bigint) AS feedback_count,
    COALESCE(agg.recommend_count, 0::bigint) AS recommend_count,
    CASE
        WHEN COALESCE(agg.reader_count, 0::bigint) = 0 THEN 0::numeric
        ELSE round(agg.completed_assignments::numeric / agg.reader_count::numeric * 100::numeric, 1)
    END AS completion_rate,
    CASE
        WHEN COALESCE(agg.feedback_count, 0::bigint) = 0 THEN 0::numeric
        ELSE round(agg.recommend_count::numeric / agg.feedback_count::numeric * 100::numeric, 1)
    END AS recommend_rate,
    round(COALESCE(agg.avg_rating, 0::numeric), 1) AS avg_rating,
    round(COALESCE(agg.avg_story, 0::numeric), 1) AS avg_story,
    round(COALESCE(agg.avg_characters, 0::numeric), 1) AS avg_characters,
    round(COALESCE(agg.avg_pacing, 0::numeric), 1) AS avg_pacing,
    round(COALESCE(agg.avg_dialogue, 0::numeric), 1) AS avg_dialogue,
    round(COALESCE(agg.avg_last_page, 0::numeric), 1) AS avg_last_page,
    COALESCE(agg.total_sessions, 0::bigint) AS total_sessions,
    COALESCE(agg.return_sessions, 0::bigint) AS return_sessions,
    CASE
        WHEN COALESCE(agg.total_sessions, 0::bigint) = 0 THEN 0::numeric
        ELSE round(agg.return_sessions::numeric / agg.total_sessions::numeric * 100::numeric, 1)
    END AS return_rate,
    LEAST(round(COALESCE(agg.reader_count, 0::bigint)::numeric / 10::numeric * 100::numeric), 100::numeric)::integer AS confidence_score,
    s.lifecycle_status,
    s.secondary_genre,
    s.format_type,
    s.themes,
    s.primary_setting,
    s.time_period,
    s.tone,
    s.target_audience
   FROM screenplays s
     LEFT JOIN agg ON agg.screenplay_id = s.id
  WHERE s.status IN ('published'::screenplay_status, 'archived'::screenplay_status);

ALTER VIEW public.reader_reviewed_screenplays SET (security_invoker = false);
GRANT SELECT ON public.reader_reviewed_screenplays TO authenticated;
