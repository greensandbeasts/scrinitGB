/*
# Scrinit — Multi-Role Architecture & Platform Foundations

## Summary
Transforms the single-role model into a scalable multi-role architecture where every
authenticated user has one account but may enable multiple roles (writer, reader, industry).
Adds global theme preferences, role-specific profiles, industry verification, and user settings.

## Changes

### 1. New Tables
- `user_roles` — tracks which roles a user has enabled (many-to-many)
- `writer_profiles` — role-specific writer data (genres, intro prefs, submission stats)
- `reader_profiles` — role-specific reader data (reading prefs, achievements, reputation)
- `industry_profiles` — role-specific industry data + verification status

### 2. Modified Tables
- `profiles` — add preferred_theme, last_active_role, country, notification_preferences, privacy_settings

### 3. New Enums
- `industry_verification_status`: unverified, pending, verified, rejected
- `industry_type`: company_representative, independent_professional

### 4. Migration of Existing Data
- Insert user_roles rows matching current role for all existing profiles
- Create role-specific profiles for existing writers, readers, industry users
- Set last_active_role for all existing users

### 5. Functions
- `get_user_roles(uuid)` — returns array of enabled roles
- `has_role(uuid, text)` — returns boolean if user has a role

### 6. RLS
- All new tables get owner-scoped policies (TO authenticated, auth.uid() = user_id)
- Industry can view writer_profiles for discovery
- Admins can view all user_roles and industry_profiles

### 7. Updated handle_new_user trigger
- Now also creates user_roles entry and role-specific profile on signup
*/

-- ──────────────────────────────────────────────────────────────────────────
-- Step 1: New Enums
-- ──────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE industry_verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE industry_type AS ENUM ('company_representative', 'independent_professional');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- Step 2: Add columns to profiles
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_theme text DEFAULT 'system' CHECK (preferred_theme IN ('light', 'dark', 'system'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_role user_role;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"email": true, "assignments": true, "requests": true}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_settings jsonb DEFAULT '{"profile_visible": true, "stats_visible": true}'::jsonb;

-- ──────────────────────────────────────────────────────────────────────────
-- Step 3: New Tables
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role user_role NOT NULL CHECK (role != 'admin'),
  enabled_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_user_roles" ON public.user_roles;
CREATE POLICY "select_own_user_roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_user_roles" ON public.user_roles;
CREATE POLICY "insert_own_user_roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_user_roles" ON public.user_roles;
CREATE POLICY "delete_own_user_roles" ON public.user_roles
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_select_all_user_roles" ON public.user_roles;
CREATE POLICY "admin_select_all_user_roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.writer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  genres text[] NOT NULL DEFAULT '{}',
  introduction_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  submission_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.writer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_writer_profile" ON public.writer_profiles;
CREATE POLICY "select_own_writer_profile" ON public.writer_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_writer_profile" ON public.writer_profiles;
CREATE POLICY "insert_own_writer_profile" ON public.writer_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_writer_profile" ON public.writer_profiles;
CREATE POLICY "update_own_writer_profile" ON public.writer_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "industry_select_writer_profiles" ON public.writer_profiles;
CREATE POLICY "industry_select_writer_profiles" ON public.writer_profiles
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'industry')
  );

CREATE TABLE IF NOT EXISTS public.reader_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  reading_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  achievements jsonb NOT NULL DEFAULT '[]'::jsonb,
  reputation_score int NOT NULL DEFAULT 0,
  contribution_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.reader_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_reader_profile" ON public.reader_profiles;
CREATE POLICY "select_own_reader_profile" ON public.reader_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_reader_profile" ON public.reader_profiles;
CREATE POLICY "insert_own_reader_profile" ON public.reader_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_reader_profile" ON public.reader_profiles;
CREATE POLICY "update_own_reader_profile" ON public.reader_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.industry_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  verification_status industry_verification_status NOT NULL DEFAULT 'unverified',
  industry_type industry_type,
  job_title text,
  company_name text,
  company_website text,
  company_email text,
  company_email_verified boolean NOT NULL DEFAULT false,
  profession text,
  linkedin_url text,
  imdb_url text,
  professional_website text,
  country text,
  discovery_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  watchlists jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.industry_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_industry_profile" ON public.industry_profiles;
CREATE POLICY "select_own_industry_profile" ON public.industry_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_industry_profile" ON public.industry_profiles;
CREATE POLICY "insert_own_industry_profile" ON public.industry_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_industry_profile" ON public.industry_profiles;
CREATE POLICY "update_own_industry_profile" ON public.industry_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_all_industry_profiles" ON public.industry_profiles;
CREATE POLICY "admin_all_industry_profiles" ON public.industry_profiles
  FOR SELECT TO authenticated USING (public.is_admin());

-- ──────────────────────────────────────────────────────────────────────────
-- Step 4: Helper Functions
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_roles(p_user_id uuid)
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT array_agg(role::text) FROM public.user_roles WHERE user_id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.has_role(p_user_id uuid, p_role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role::text = p_role);
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- Step 5: Migrate existing data
-- ──────────────────────────────────────────────────────────────────────────

-- Insert user_roles for all existing profiles
INSERT INTO public.user_roles (user_id, role)
SELECT id, CASE WHEN role = 'admin' THEN 'writer' ELSE role END as role
FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;

-- Set last_active_role for existing users
UPDATE public.profiles
SET last_active_role = CASE WHEN role = 'admin' THEN 'writer' ELSE role END
WHERE last_active_role IS NULL;

-- Create writer_profiles for writers (and admins who default to writer)
INSERT INTO public.writer_profiles (user_id)
SELECT p.id FROM public.profiles p
WHERE (p.role = 'writer' OR p.role = 'admin')
ON CONFLICT (user_id) DO NOTHING;

-- Create reader_profiles for readers
INSERT INTO public.reader_profiles (user_id)
SELECT p.id FROM public.profiles p
WHERE p.role = 'reader'
ON CONFLICT (user_id) DO NOTHING;

-- Create industry_profiles for industry users (pre-verified)
INSERT INTO public.industry_profiles (user_id, verification_status, industry_type, company_name, country)
SELECT p.id, 'verified', 'company_representative', p.company, 'United States'
FROM public.profiles p
WHERE p.role = 'industry'
ON CONFLICT (user_id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- Step 6: Update handle_new_user trigger
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name text;
  v_role user_role;
  v_company text;
  v_bio text;
  v_avatar_color text;
BEGIN
  v_display_name := COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1));
  v_role := COALESCE((new.raw_user_meta_data->>'role')::user_role, 'writer');
  v_company := new.raw_user_meta_data->>'company';
  v_bio := new.raw_user_meta_data->>'bio';
  v_avatar_color := COALESCE(new.raw_user_meta_data->>'avatar_color', 'slate');

  IF v_role = 'admin' THEN
    v_role := 'writer';
  END IF;

  INSERT INTO public.profiles (id, email, display_name, role, company, bio, avatar_color, last_active_role)
  VALUES (new.id, new.email, v_display_name, v_role, v_company, v_bio, v_avatar_color, v_role)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF v_role = 'writer' THEN
    INSERT INTO public.writer_profiles (user_id) VALUES (new.id) ON CONFLICT (user_id) DO NOTHING;
  ELSIF v_role = 'reader' THEN
    INSERT INTO public.reader_profiles (user_id) VALUES (new.id) ON CONFLICT (user_id) DO NOTHING;
  ELSIF v_role = 'industry' THEN
    INSERT INTO public.industry_profiles (user_id, verification_status) VALUES (new.id, 'unverified') ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- Step 7: Grants
-- ──────────────────────────────────────────────────────────────────────────
GRANT SELECT ON public.user_roles TO authenticated;
GRANT INSERT, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.writer_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.reader_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.industry_profiles TO authenticated;
