/*
# Scrinit Build 02 — Secure Screenplay Reader, PDF Upload & Anonymous Discovery

## Summary
Extends the platform to support PDF screenplay uploads, anonymous reading copies,
industry qualification, a unified secure reader, introduction requests with identity
reveal, industry reading sessions, notifications, and configurable platform settings.

## New Tables
1. `industry_reading_sessions` — tracks industry member reading behaviour separately from reader sessions
2. `notifications` — platform notifications for writers and industry members
3. `platform_settings` — admin-configurable thresholds for qualification, mature dataset, priority reduction

## Modified Tables
1. `screenplays` — adds columns for PDF storage paths, visibility, industry qualification, format, budget, themes, etc.
2. `industry_requests` — adds columns for request_type, reason_for_contact, identity reveal fields
3. `profiles` — adds identity_reveal_preferences column

## New Storage Buckets
1. `screenplays` — private bucket for original PDF uploads (writer + admin access only)
2. `anonymous-copies` — private bucket for sanitised anonymous reading copies

## New Enums
1. `screenplay_visibility` — private, readers_only, industry_qualified
2. `industry_access_setting` — open_to_verified, request_approval, private
3. `industry_request_type` — reading_access, introduction
*/

-- ──────────────────────────────────────────────────────────────────────────
-- Step 1: New Enums
-- ──────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE screenplay_visibility AS ENUM ('private', 'readers_only', 'industry_qualified');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE industry_access_setting AS ENUM ('open_to_verified', 'request_approval', 'private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE industry_request_type AS ENUM ('reading_access', 'introduction');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- Step 2: Add columns to screenplays
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.screenplays ADD COLUMN IF NOT EXISTS original_pdf_path text;
ALTER TABLE public.screenplays ADD COLUMN IF NOT EXISTS anonymous_pdf_path text;
ALTER TABLE public.screenplays ADD COLUMN IF NOT EXISTS visibility screenplay_visibility DEFAULT 'private';
ALTER TABLE public.screenplays ADD COLUMN IF NOT EXISTS industry_access industry_access_setting DEFAULT 'open_to_verified';
ALTER TABLE public.screenplays ADD COLUMN IF NOT EXISTS industry_qualified boolean DEFAULT false;
ALTER TABLE public.screenplays ADD COLUMN IF NOT EXISTS assignment_paused boolean DEFAULT false;
ALTER TABLE public.screenplays ADD COLUMN IF NOT EXISTS secondary_genre text;
ALTER TABLE public.screenplays ADD COLUMN IF NOT EXISTS format_type text;
ALTER TABLE public.screenplays ADD COLUMN IF NOT EXISTS budget_range text;
ALTER TABLE public.screenplays ADD COLUMN IF NOT EXISTS themes text[] DEFAULT '{}';
ALTER TABLE public.screenplays ADD COLUMN IF NOT EXISTS primary_setting text;
ALTER TABLE public.screenplays ADD COLUMN IF NOT EXISTS time_period text;
ALTER TABLE public.screenplays ADD COLUMN IF NOT EXISTS tone text;
ALTER TABLE public.screenplays ADD COLUMN IF NOT EXISTS target_audience text;
ALTER TABLE public.screenplays ADD COLUMN IF NOT EXISTS sanitisation_notes text;

UPDATE public.screenplays SET visibility = 'readers_only' WHERE status = 'published' AND visibility = 'private';

-- ──────────────────────────────────────────────────────────────────────────
-- Step 3: Add columns to industry_requests
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.industry_requests ADD COLUMN IF NOT EXISTS request_type industry_request_type DEFAULT 'introduction';
ALTER TABLE public.industry_requests ADD COLUMN IF NOT EXISTS reason_for_contact text;
ALTER TABLE public.industry_requests ADD COLUMN IF NOT EXISTS profession_snapshot text;
ALTER TABLE public.industry_requests ADD COLUMN IF NOT EXISTS identity_revealed boolean DEFAULT false;
ALTER TABLE public.industry_requests ADD COLUMN IF NOT EXISTS identity_fields_revealed jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.industry_requests ADD COLUMN IF NOT EXISTS writer_response_message text;

-- ──────────────────────────────────────────────────────────────────────────
-- Step 4: Add identity_reveal_preferences to profiles
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS identity_reveal_preferences jsonb DEFAULT '{"name": true, "biography": true, "website": false, "imdb": false, "email": false, "phone": false, "agent": false, "contact_through_scrinit": true}'::jsonb;

-- ──────────────────────────────────────────────────────────────────────────
-- Step 5: New Tables
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.industry_reading_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screenplay_id uuid NOT NULL REFERENCES public.screenplays(id) ON DELETE CASCADE,
  industry_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_number int NOT NULL DEFAULT 1,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  last_page_reached int NOT NULL DEFAULT 1,
  pages_read_this_session int NOT NULL DEFAULT 0,
  duration_seconds int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  UNIQUE(screenplay_id, industry_user_id, session_number)
);

ALTER TABLE public.industry_reading_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_industry_sessions" ON public.industry_reading_sessions;
CREATE POLICY "select_own_industry_sessions" ON public.industry_reading_sessions
  FOR SELECT TO authenticated USING (auth.uid() = industry_user_id);

DROP POLICY IF EXISTS "insert_own_industry_sessions" ON public.industry_reading_sessions;
CREATE POLICY "insert_own_industry_sessions" ON public.industry_reading_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = industry_user_id);

DROP POLICY IF EXISTS "update_own_industry_sessions" ON public.industry_reading_sessions;
CREATE POLICY "update_own_industry_sessions" ON public.industry_reading_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = industry_user_id) WITH CHECK (auth.uid() = industry_user_id);

DROP POLICY IF EXISTS "writer_select_industry_sessions" ON public.industry_reading_sessions;
CREATE POLICY "writer_select_industry_sessions" ON public.industry_reading_sessions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.screenplays s WHERE s.id = industry_reading_sessions.screenplay_id AND s.writer_id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_select_industry_sessions" ON public.industry_reading_sessions;
CREATE POLICY "admin_select_industry_sessions" ON public.industry_reading_sessions
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_industry_sessions_screenplay ON public.industry_reading_sessions(screenplay_id);
CREATE INDEX IF NOT EXISTS idx_industry_sessions_user ON public.industry_reading_sessions(industry_user_id);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  screenplay_id uuid REFERENCES public.screenplays(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.industry_requests(id) ON DELETE CASCADE,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notifications" ON public.notifications;
CREATE POLICY "select_own_notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON public.notifications;
CREATE POLICY "update_own_notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON public.notifications;
CREATE POLICY "insert_own_notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_select_all_notifications" ON public.notifications;
CREATE POLICY "admin_select_all_notifications" ON public.notifications
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read, created_at DESC);

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id int PRIMARY KEY DEFAULT 1,
  min_completed_assignments int NOT NULL DEFAULT 12,
  min_recommendations int NOT NULL DEFAULT 3,
  min_confidence_level text NOT NULL DEFAULT 'moderate' CHECK (min_confidence_level IN ('low', 'moderate', 'strong', 'high')),
  mature_dataset_threshold int NOT NULL DEFAULT 30,
  priority_reduction_threshold int NOT NULL DEFAULT 100,
  max_upload_mb int NOT NULL DEFAULT 25,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_platform_settings" ON public.platform_settings;
CREATE POLICY "select_platform_settings" ON public.platform_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_update_platform_settings" ON public.platform_settings;
CREATE POLICY "admin_update_platform_settings" ON public.platform_settings
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- Step 6: Storage Buckets
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES ('screenplays', 'screenplays', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('anonymous-copies', 'anonymous-copies', false) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "writers_upload_own_screenplays" ON storage.objects;
CREATE POLICY "writers_upload_own_screenplays" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'screenplays' AND auth.uid() = (storage.foldername(name))[1]::uuid
  );

DROP POLICY IF EXISTS "writers_read_own_screenplays" ON storage.objects;
CREATE POLICY "writers_read_own_screenplays" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'screenplays' AND auth.uid() = (storage.foldername(name))[1]::uuid
  );

DROP POLICY IF EXISTS "admin_all_screenplays_storage" ON storage.objects;
CREATE POLICY "admin_all_screenplays_storage" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'screenplays' AND public.is_admin()
  );

DROP POLICY IF EXISTS "writers_upload_anonymous_copies" ON storage.objects;
CREATE POLICY "writers_upload_anonymous_copies" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'anonymous-copies' AND auth.uid() = (storage.foldername(name))[1]::uuid
  );

DROP POLICY IF EXISTS "writers_read_own_anonymous_copies" ON storage.objects;
CREATE POLICY "writers_read_own_anonymous_copies" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'anonymous-copies' AND auth.uid() = (storage.foldername(name))[1]::uuid
  );

DROP POLICY IF EXISTS "admin_all_anonymous_copies_storage" ON storage.objects;
CREATE POLICY "admin_all_anonymous_copies_storage" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'anonymous-copies' AND public.is_admin()
  );

-- ──────────────────────────────────────────────────────────────────────────
-- Step 7: Functions
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_industry_qualification(p_screenplay_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completed_count int;
  v_recommend_count int;
  v_confidence_score int;
  v_min_completed int;
  v_min_recommends int;
  v_min_confidence text;
  v_confidence_level text;
BEGIN
  SELECT min_completed_assignments, min_recommendations, min_confidence_level
  INTO v_min_completed, v_min_recommends, v_min_confidence
  FROM platform_settings WHERE id = 1;

  SELECT 
    COUNT(*) FILTER (WHERE a.status = 'completed'),
    (SELECT COUNT(*) FROM reader_feedback f WHERE f.screenplay_id = p_screenplay_id AND f.would_recommend = true)
  INTO v_completed_count, v_recommend_count
  FROM assignments a WHERE a.screenplay_id = p_screenplay_id;

  SELECT confidence_score INTO v_confidence_score
  FROM screenplay_discovery WHERE id = p_screenplay_id;

  IF v_confidence_score >= 75 THEN v_confidence_level := 'high';
  ELSIF v_confidence_score >= 50 THEN v_confidence_level := 'strong';
  ELSIF v_confidence_score >= 25 THEN v_confidence_level := 'moderate';
  ELSE v_confidence_level := 'low';
  END IF;

  IF v_completed_count >= v_min_completed 
     AND v_recommend_count >= v_min_recommends
     AND (
       (v_min_confidence = 'low') OR
       (v_min_confidence = 'moderate' AND v_confidence_level IN ('moderate','strong','high')) OR
       (v_min_confidence = 'strong' AND v_confidence_level IN ('strong','high')) OR
       (v_min_confidence = 'high' AND v_confidence_level = 'high')
     )
  THEN
    UPDATE screenplays SET industry_qualified = true, visibility = 'industry_qualified' 
    WHERE id = p_screenplay_id AND visibility = 'readers_only';
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_industry_qualification(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text DEFAULT NULL,
  p_screenplay_id uuid DEFAULT NULL,
  p_request_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, screenplay_id, request_id)
  VALUES (p_user_id, p_type, p_title, p_body, p_screenplay_id, p_request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, uuid, uuid) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- Step 8: Grants
-- ──────────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON public.industry_reading_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT ON public.platform_settings TO authenticated;
