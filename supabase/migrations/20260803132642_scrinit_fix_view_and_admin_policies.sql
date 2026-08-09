/*
# Fix screenplay_discovery view + add admin moderation policies

## Summary
1. Recreate screenplay_discovery as SECURITY DEFINER so RLS on profiles doesn't block the join
2. Add admin UPDATE policy on profiles so admins can moderate users (change role, suspend)
3. Add admin UPDATE policy on screenplays (already exists via is_admin in existing policies, but verify)
4. Add a 'suspended' column to profiles for moderation
*/

-- ──────────────────────────────────────────────────────────────────────────
-- Step 1: Recreate screenplay_discovery view with security_invoker = false
-- This makes the view run with the owner's permissions, bypassing RLS on
-- the underlying tables. The view itself has SELECT granted to authenticated.
-- ──────────────────────────────────────────────────────────────────────────
ALTER VIEW public.screenplay_discovery SET (security_invoker = false);

-- ──────────────────────────────────────────────────────────────────────────
-- Step 2: Add admin moderation policies on profiles
-- The current update policy only allows auth.uid() = id, so admins can't
-- update other users' profiles. Add a separate admin update policy.
-- ──────────────────────────────────────────────────────────────────────────
CREATE POLICY "admin_update_profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ──────────────────────────────────────────────────────────────────────────
-- Step 3: Add suspended column to profiles for moderation
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_reason text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
