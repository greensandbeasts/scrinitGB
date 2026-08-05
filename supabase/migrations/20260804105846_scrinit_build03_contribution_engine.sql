/*
# Build 3 — Reader Contribution Engine & Analytics Reliability

## Summary
Complete database extension for the Reader Contribution Engine and Analytics
Reliability Engine. Adds contribution balances, upload credits, versioned
algorithm configuration, contribution events, credit transactions, analytics
weights, reliability flags, and extended reading session tracking.

## New Tables
1. `contribution_algorithm_versions` — Versioned configuration snapshots.
2. `reader_contribution_balances` — Per-reader balance of contribution points and upload credits.
3. `contribution_events` — Immutable ledger of every contribution point award.
4. `credit_transactions` — Immutable ledger of every upload credit award and spend.
5. `analytics_weights` — Per-session analytics reliability weight. Admin-only.
6. `reliability_flags` — Per-session flags for suspicious activity. Admin-only.
7. `feedback_quality_scores` — AI feedback quality analysis results.

## Modified Tables
1. `reading_sessions` — Added scroll_position, active_reading_seconds, stop_reason, algorithm_version_id.
2. `reader_feedback` — Added ai_quality_score, ai_quality_enabled, stop_page, algorithm_version_id.
3. `assignments` — Added contribution_awarded flag.

## Security
- RLS enabled on all new tables with owner-scoped policies.
- Analytics weights and reliability flags are admin-only (readers never see them).
- SECURITY DEFINER helper functions prevent RLS recursion.
*/

-- ============================================================================
-- ENUMS
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE contribution_source AS ENUM ('pages', 'time', 'feedback', 'completion', 'bonus', 'adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE credit_type AS ENUM ('free', 'earned', 'spent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE analytics_weight_level AS ENUM ('full', 'reduced', 'low', 'excluded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reliability_flag_type AS ENUM (
    'rapid_scrolling', 'impossible_progression', 'browser_automation',
    'copy_paste_feedback', 'ai_generated_feedback', 'identical_reviews',
    'excessive_inactivity', 'session_padding'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- TABLE: contribution_algorithm_versions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contribution_algorithm_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number int NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  activated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  points_per_credit int NOT NULL DEFAULT 1000,
  page_points_enabled boolean NOT NULL DEFAULT true,
  points_per_page numeric NOT NULL DEFAULT 1.0,
  time_points_enabled boolean NOT NULL DEFAULT true,
  minutes_per_point numeric NOT NULL DEFAULT 2.0,
  max_time_contribution int NOT NULL DEFAULT 200,
  inactivity_timeout_seconds int NOT NULL DEFAULT 180,
  feedback_bonus_enabled boolean NOT NULL DEFAULT true,
  feedback_starting_bonus int NOT NULL DEFAULT 30,
  feedback_reduction_rate int NOT NULL DEFAULT 3,
  feedback_reduction_amount int NOT NULL DEFAULT 1,
  feedback_min_bonus int NOT NULL DEFAULT 10,
  feedback_min_chars int NOT NULL DEFAULT 120,
  feedback_max_chars int NOT NULL DEFAULT 500,
  ai_quality_enabled boolean NOT NULL DEFAULT false,
  ai_quality_threshold numeric NOT NULL DEFAULT 0.5,
  ai_quality_weighting numeric NOT NULL DEFAULT 0.3,
  completion_bonus_enabled boolean NOT NULL DEFAULT true,
  completion_bonus_points int NOT NULL DEFAULT 50,
  max_contribution_per_screenplay int NOT NULL DEFAULT 500,
  analytics_enabled boolean NOT NULL DEFAULT true,
  weight_full numeric NOT NULL DEFAULT 1.0,
  weight_reduced numeric NOT NULL DEFAULT 0.75,
  weight_low numeric NOT NULL DEFAULT 0.50,
  weight_excluded numeric NOT NULL DEFAULT 0.00,
  integrity_checks jsonb NOT NULL DEFAULT '{"min_active_reading_seconds": 30, "max_page_skip": 5, "rapid_scroll_threshold_ms": 200, "max_inactive_sessions_pct": 50, "min_feedback_quality": 0.3}'::jsonb,
  exclusion_thresholds jsonb NOT NULL DEFAULT '{"auto_exclude_flags": 3, "min_weight_for_inclusion": 0.25}'::jsonb,
  is_active boolean NOT NULL DEFAULT false
);

ALTER TABLE public.contribution_algorithm_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_algorithm_versions_admin ON public.contribution_algorithm_versions;
CREATE POLICY select_algorithm_versions_admin ON public.contribution_algorithm_versions
  FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS insert_algorithm_versions_admin ON public.contribution_algorithm_versions;
CREATE POLICY insert_algorithm_versions_admin ON public.contribution_algorithm_versions
  FOR INSERT TO authenticated WITH CHECK (is_admin());

INSERT INTO public.contribution_algorithm_versions (version_number, is_active)
SELECT 1, true
WHERE NOT EXISTS (SELECT 1 FROM public.contribution_algorithm_versions WHERE version_number = 1);

-- ============================================================================
-- TABLE: reader_contribution_balances
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reader_contribution_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reader_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  contribution_points int NOT NULL DEFAULT 0,
  upload_credits int NOT NULL DEFAULT 0,
  total_credits_earned int NOT NULL DEFAULT 0,
  free_upload_used boolean NOT NULL DEFAULT false,
  current_algorithm_version_id uuid REFERENCES public.contribution_algorithm_versions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reader_contribution_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_own_balance ON public.reader_contribution_balances;
CREATE POLICY select_own_balance ON public.reader_contribution_balances
  FOR SELECT TO authenticated USING (reader_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS insert_own_balance ON public.reader_contribution_balances;
CREATE POLICY insert_own_balance ON public.reader_contribution_balances
  FOR INSERT TO authenticated WITH CHECK (reader_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS update_own_balance ON public.reader_contribution_balances;
CREATE POLICY update_own_balance ON public.reader_contribution_balances
  FOR UPDATE TO authenticated USING (reader_id = auth.uid() OR is_admin())
  WITH CHECK (reader_id = auth.uid() OR is_admin());

-- ============================================================================
-- TABLE: contribution_events
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contribution_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  screenplay_id uuid NOT NULL REFERENCES public.screenplays(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE CASCADE,
  reading_session_id uuid REFERENCES public.reading_sessions(id) ON DELETE SET NULL,
  algorithm_version_id uuid REFERENCES public.contribution_algorithm_versions(id),
  source contribution_source NOT NULL,
  points_awarded int NOT NULL,
  points_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contribution_events_reader ON public.contribution_events(reader_id);
CREATE INDEX IF NOT EXISTS idx_contribution_events_screenplay ON public.contribution_events(screenplay_id);

ALTER TABLE public.contribution_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_own_events ON public.contribution_events;
CREATE POLICY select_own_events ON public.contribution_events
  FOR SELECT TO authenticated USING (reader_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS insert_own_events ON public.contribution_events;
CREATE POLICY insert_own_events ON public.contribution_events
  FOR INSERT TO authenticated WITH CHECK (reader_id = auth.uid() OR is_admin());

-- ============================================================================
-- TABLE: credit_transactions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type credit_type NOT NULL,
  credits int NOT NULL,
  points_spent int NOT NULL DEFAULT 0,
  screenplay_id uuid REFERENCES public.screenplays(id) ON DELETE SET NULL,
  algorithm_version_id uuid REFERENCES public.contribution_algorithm_versions(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_reader ON public.credit_transactions(reader_id);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_own_credits ON public.credit_transactions;
CREATE POLICY select_own_credits ON public.credit_transactions
  FOR SELECT TO authenticated USING (reader_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS insert_own_credits ON public.credit_transactions;
CREATE POLICY insert_own_credits ON public.credit_transactions
  FOR INSERT TO authenticated WITH CHECK (reader_id = auth.uid() OR is_admin());

-- ============================================================================
-- TABLE: analytics_weights — Admin-only. Readers never see these.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.analytics_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_session_id uuid NOT NULL UNIQUE REFERENCES public.reading_sessions(id) ON DELETE CASCADE,
  screenplay_id uuid NOT NULL REFERENCES public.screenplays(id) ON DELETE CASCADE,
  reader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight numeric NOT NULL DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 1.0),
  weight_level analytics_weight_level NOT NULL DEFAULT 'full',
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  algorithm_version_id uuid REFERENCES public.contribution_algorithm_versions(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_weights_screenplay ON public.analytics_weights(screenplay_id);

ALTER TABLE public.analytics_weights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_weights_admin ON public.analytics_weights;
CREATE POLICY select_weights_admin ON public.analytics_weights
  FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS insert_weights_admin ON public.analytics_weights;
CREATE POLICY insert_weights_admin ON public.analytics_weights
  FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS update_weights_admin ON public.analytics_weights;
CREATE POLICY update_weights_admin ON public.analytics_weights
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================================
-- TABLE: reliability_flags — Admin-only.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reliability_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_session_id uuid NOT NULL REFERENCES public.reading_sessions(id) ON DELETE CASCADE,
  screenplay_id uuid NOT NULL REFERENCES public.screenplays(id) ON DELETE CASCADE,
  reader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flag_type reliability_flag_type NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  admin_notified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reliability_flags_session ON public.reliability_flags(reading_session_id);
CREATE INDEX IF NOT EXISTS idx_reliability_flags_reader ON public.reliability_flags(reader_id);

ALTER TABLE public.reliability_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_flags_admin ON public.reliability_flags;
CREATE POLICY select_flags_admin ON public.reliability_flags
  FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS insert_flags_reader ON public.reliability_flags;
CREATE POLICY insert_flags_reader ON public.reliability_flags
  FOR INSERT TO authenticated WITH CHECK (reader_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS update_flags_admin ON public.reliability_flags;
CREATE POLICY update_flags_admin ON public.reliability_flags
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================================
-- TABLE: feedback_quality_scores
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.feedback_quality_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL UNIQUE REFERENCES public.reader_feedback(id) ON DELETE CASCADE,
  reader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  screenplay_id uuid NOT NULL REFERENCES public.screenplays(id) ON DELETE CASCADE,
  quality_score numeric NOT NULL DEFAULT 0.0 CHECK (quality_score >= 0 AND quality_score <= 1.0),
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  analysis_text text,
  algorithm_version_id uuid REFERENCES public.contribution_algorithm_versions(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_quality_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_quality_scores ON public.feedback_quality_scores;
CREATE POLICY select_quality_scores ON public.feedback_quality_scores
  FOR SELECT TO authenticated
  USING (reader_id = auth.uid() OR is_admin() OR is_screenplay_writer(screenplay_id, auth.uid()));

DROP POLICY IF EXISTS insert_quality_scores ON public.feedback_quality_scores;
CREATE POLICY insert_quality_scores ON public.feedback_quality_scores
  FOR INSERT TO authenticated WITH CHECK (reader_id = auth.uid() OR is_admin());

-- ============================================================================
-- EXTEND EXISTING TABLES
-- ============================================================================
ALTER TABLE public.reading_sessions
  ADD COLUMN IF NOT EXISTS scroll_position float DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active_reading_seconds int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stop_reason text,
  ADD COLUMN IF NOT EXISTS algorithm_version_id uuid REFERENCES public.contribution_algorithm_versions(id);

ALTER TABLE public.reader_feedback
  ADD COLUMN IF NOT EXISTS ai_quality_score float,
  ADD COLUMN IF NOT EXISTS ai_quality_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stop_page int,
  ADD COLUMN IF NOT EXISTS algorithm_version_id uuid REFERENCES public.contribution_algorithm_versions(id);

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS contribution_awarded boolean NOT NULL DEFAULT false;

-- ============================================================================
-- SECURITY DEFINER HELPER FUNCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_active_algorithm_version()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT id FROM public.contribution_algorithm_versions WHERE is_active = true ORDER BY version_number DESC LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_active_algorithm_version() TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_algorithm_config()
RETURNS public.contribution_algorithm_versions
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT * FROM public.contribution_algorithm_versions WHERE is_active = true ORDER BY version_number DESC LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_algorithm_config() TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_or_create_balance(p_reader_id uuid)
RETURNS public.reader_contribution_balances
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_balance public.reader_contribution_balances;
  v_version_id uuid;
BEGIN
  SELECT * INTO v_balance FROM public.reader_contribution_balances WHERE reader_id = p_reader_id;
  IF NOT FOUND THEN
    v_version_id := public.get_active_algorithm_version();
    INSERT INTO public.reader_contribution_balances (reader_id, current_algorithm_version_id)
    VALUES (p_reader_id, v_version_id)
    RETURNING * INTO v_balance;
  END IF;
  RETURN v_balance;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_or_create_balance(uuid) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.award_contribution_points(
  p_reader_id uuid, p_screenplay_id uuid, p_assignment_id uuid,
  p_reading_session_id uuid, p_source text, p_points int,
  p_breakdown jsonb DEFAULT '{}'::jsonb
)
RETURNS public.reader_contribution_balances
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_balance public.reader_contribution_balances;
  v_config public.contribution_algorithm_versions;
  v_credits_to_award int;
  v_points_to_deduct int;
  v_version_id uuid;
BEGIN
  IF p_points <= 0 THEN
    RETURN public.get_or_create_balance(p_reader_id);
  END IF;
  v_balance := public.get_or_create_balance(p_reader_id);
  SELECT * INTO v_config FROM public.contribution_algorithm_versions WHERE is_active = true ORDER BY version_number DESC LIMIT 1;
  v_version_id := v_config.id;
  v_balance.contribution_points := v_balance.contribution_points + p_points;
  WHILE v_balance.contribution_points >= v_config.points_per_credit LOOP
    v_credits_to_award := v_balance.contribution_points / v_config.points_per_credit;
    v_points_to_deduct := v_credits_to_award * v_config.points_per_credit;
    v_balance.upload_credits := v_balance.upload_credits + v_credits_to_award;
    v_balance.total_credits_earned := v_balance.total_credits_earned + v_credits_to_award;
    v_balance.contribution_points := v_balance.contribution_points - v_points_to_deduct;
    INSERT INTO public.credit_transactions (reader_id, type, credits, points_spent, algorithm_version_id, note)
    VALUES (p_reader_id, 'earned', v_credits_to_award, v_points_to_deduct, v_version_id,
            'Automatic conversion: ' || v_points_to_deduct || ' points = ' || v_credits_to_award || ' credits');
  END LOOP;
  UPDATE public.reader_contribution_balances
  SET contribution_points = v_balance.contribution_points,
      upload_credits = v_balance.upload_credits,
      total_credits_earned = v_balance.total_credits_earned,
      current_algorithm_version_id = v_version_id,
      updated_at = now()
  WHERE reader_id = p_reader_id;
  INSERT INTO public.contribution_events (reader_id, screenplay_id, assignment_id, reading_session_id, source, points_awarded, points_breakdown, algorithm_version_id)
  VALUES (p_reader_id, p_screenplay_id, p_assignment_id, p_reading_session_id, p_source::contribution_source, p_points, p_breakdown, v_version_id);
  RETURN v_balance;
END;
$$;
GRANT EXECUTE ON FUNCTION public.award_contribution_points(uuid, uuid, uuid, uuid, text, int, jsonb) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.mark_assignment_contribution_awarded(p_assignment_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.assignments SET contribution_awarded = true WHERE id = p_assignment_id;
$$;
GRANT EXECUTE ON FUNCTION public.mark_assignment_contribution_awarded(uuid) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.check_upload_eligibility(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_balance public.reader_contribution_balances;
BEGIN
  v_balance := public.get_or_create_balance(p_user_id);
  IF NOT v_balance.free_upload_used THEN
    RETURN 'free';
  ELSIF v_balance.upload_credits > 0 THEN
    RETURN 'earned';
  ELSE
    RETURN 'none';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_upload_eligibility(uuid) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.consume_upload_credit(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_balance public.reader_contribution_balances;
  v_version_id uuid;
BEGIN
  v_balance := public.get_or_create_balance(p_user_id);
  IF NOT v_balance.free_upload_used THEN
    UPDATE public.reader_contribution_balances SET free_upload_used = true, updated_at = now() WHERE reader_id = p_user_id;
    INSERT INTO public.credit_transactions (reader_id, type, credits, note)
    VALUES (p_user_id, 'free', 1, 'Free upload credit used');
    RETURN true;
  ELSIF v_balance.upload_credits > 0 THEN
    UPDATE public.reader_contribution_balances SET upload_credits = upload_credits - 1, updated_at = now() WHERE reader_id = p_user_id;
    v_version_id := public.get_active_algorithm_version();
    INSERT INTO public.credit_transactions (reader_id, type, credits, algorithm_version_id, note)
    VALUES (p_user_id, 'spent', 1, v_version_id, 'Earned upload credit spent');
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.consume_upload_credit(uuid) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.create_algorithm_version(p_activated_by uuid, p_config jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_next_version int;
  v_new_id uuid;
BEGIN
  SELECT COALESCE(max(version_number), 0) + 1 INTO v_next_version FROM public.contribution_algorithm_versions;
  UPDATE public.contribution_algorithm_versions SET is_active = false WHERE is_active = true;
  INSERT INTO public.contribution_algorithm_versions (
    version_number, activated_by, is_active,
    points_per_credit,
    page_points_enabled, points_per_page,
    time_points_enabled, minutes_per_point, max_time_contribution, inactivity_timeout_seconds,
    feedback_bonus_enabled, feedback_starting_bonus, feedback_reduction_rate, feedback_reduction_amount, feedback_min_bonus, feedback_min_chars, feedback_max_chars,
    ai_quality_enabled, ai_quality_threshold, ai_quality_weighting,
    completion_bonus_enabled, completion_bonus_points,
    max_contribution_per_screenplay,
    analytics_enabled, weight_full, weight_reduced, weight_low, weight_excluded,
    integrity_checks, exclusion_thresholds
  ) VALUES (
    v_next_version, p_activated_by, true,
    COALESCE((p_config->>'points_per_credit')::int, 1000),
    COALESCE((p_config->>'page_points_enabled')::boolean, true),
    COALESCE((p_config->>'points_per_page')::numeric, 1.0),
    COALESCE((p_config->>'time_points_enabled')::boolean, true),
    COALESCE((p_config->>'minutes_per_point')::numeric, 2.0),
    COALESCE((p_config->>'max_time_contribution')::int, 200),
    COALESCE((p_config->>'inactivity_timeout_seconds')::int, 180),
    COALESCE((p_config->>'feedback_bonus_enabled')::boolean, true),
    COALESCE((p_config->>'feedback_starting_bonus')::int, 30),
    COALESCE((p_config->>'feedback_reduction_rate')::int, 3),
    COALESCE((p_config->>'feedback_reduction_amount')::int, 1),
    COALESCE((p_config->>'feedback_min_bonus')::int, 10),
    COALESCE((p_config->>'feedback_min_chars')::int, 120),
    COALESCE((p_config->>'feedback_max_chars')::int, 500),
    COALESCE((p_config->>'ai_quality_enabled')::boolean, false),
    COALESCE((p_config->>'ai_quality_threshold')::numeric, 0.5),
    COALESCE((p_config->>'ai_quality_weighting')::numeric, 0.3),
    COALESCE((p_config->>'completion_bonus_enabled')::boolean, true),
    COALESCE((p_config->>'completion_bonus_points')::int, 50),
    COALESCE((p_config->>'max_contribution_per_screenplay')::int, 500),
    COALESCE((p_config->>'analytics_enabled')::boolean, true),
    COALESCE((p_config->>'weight_full')::numeric, 1.0),
    COALESCE((p_config->>'weight_reduced')::numeric, 0.75),
    COALESCE((p_config->>'weight_low')::numeric, 0.50),
    COALESCE((p_config->>'weight_excluded')::numeric, 0.00),
    COALESCE(p_config->'integrity_checks', '{}'::jsonb),
    COALESCE(p_config->'exclusion_thresholds', '{}'::jsonb)
  )
  RETURNING id INTO v_new_id;
  RETURN v_new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_algorithm_version(uuid, jsonb) TO authenticated;

-- ============================================================================
-- UPDATE ASSIGNMENT ENGINE with exclusion rules
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auto_assign_readers(p_screenplay_id uuid)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
  v_max_new int;
BEGIN
  SELECT * INTO v_screenplay FROM screenplays WHERE id = p_screenplay_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF v_screenplay.status != 'published' THEN RETURN 0; END IF;
  IF v_screenplay.visibility = 'private' THEN RETURN 0; END IF;
  IF v_screenplay.assignment_paused THEN RETURN 0; END IF;
  SELECT * INTO v_settings FROM platform_settings WHERE id = 1;
  v_mature_threshold := v_settings.mature_dataset_threshold;
  v_priority_threshold := v_settings.priority_reduction_threshold;
  SELECT count(*) INTO v_completed_for_this
  FROM assignments WHERE screenplay_id = p_screenplay_id AND status = 'completed';
  IF v_completed_for_this >= v_priority_threshold THEN v_max_new := 1;
  ELSIF v_completed_for_this >= v_mature_threshold THEN v_max_new := 2;
  ELSE v_max_new := 5; END IF;
  FOR v_reader_record IN
    SELECT p.id as reader_id,
      (SELECT count(*) FROM assignments a WHERE a.reader_id = p.id AND a.status IN ('assigned','in_progress')) as active_load
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id AND ur.role = 'reader'
    WHERE p.id != v_screenplay.writer_id
      AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.screenplay_id = p_screenplay_id AND a.reader_id = p.id)
      AND NOT COALESCE(p.suspended, false)
    ORDER BY active_load ASC, p.created_at ASC
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
$$;

-- ============================================================================
-- CREATE INITIAL BALANCES FOR EXISTING READERS
-- ============================================================================
INSERT INTO public.reader_contribution_balances (reader_id, current_algorithm_version_id)
SELECT p.id, public.get_active_algorithm_version()
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'reader'
WHERE NOT EXISTS (SELECT 1 FROM public.reader_contribution_balances b WHERE b.reader_id = p.id);
