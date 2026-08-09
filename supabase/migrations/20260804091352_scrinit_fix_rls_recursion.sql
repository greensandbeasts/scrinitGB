-- ============================================================================
-- Migration: scrinit_fix_rls_recursion
--
-- Problem: PostgreSQL error 42P17 "infinite recursion detected in policy
-- for relation 'screenplays'"
--
-- Root cause: circular RLS policy dependencies.
--   screenplays SELECT policy → EXISTS subquery on assignments
--   assignments SELECT policy → EXISTS subquery on screenplays
--   screenplays SELECT policy → EXISTS subquery on industry_requests (also RLS)
--   reader_feedback SELECT policy → EXISTS subquery on screenplays
--   reading_sessions SELECT policy → EXISTS subquery on screenplays
--   industry_reading_sessions writer SELECT → EXISTS subquery on screenplays
--
-- Each EXISTS subquery on an RLS-protected table re-evaluates that table's
-- SELECT policies, which in turn issue more EXISTS subqueries, creating
-- unbounded recursion.
--
-- Solution: Replace every cross-table EXISTS subquery inside RLS policies
-- with SECURITY DEFINER helper functions. SECURITY DEFINER functions execute
-- with the function owner's (postgres) privileges and bypass RLS entirely,
-- so calling them from within a policy never re-enters the RLS evaluation
-- loop.
--
-- This migration drops and recreates all RLS policies for:
--   screenplays, assignments, reader_feedback, reading_sessions,
--   industry_reading_sessions
--
-- It also creates three new SECURITY DEFINER helper functions:
--   is_screenplay_writer(p_screenplay_id uuid, p_user_id uuid)
--   is_assigned_reader(p_screenplay_id uuid, p_user_id uuid)
--   has_approved_industry_request(p_screenplay_id uuid, p_user_id uuid)
--
-- The existing is_admin() function is already SECURITY DEFINER and does not
-- contribute to recursion, so it is left unchanged.
--
-- Permission model preserved:
--   Writers: full CRUD on own screenplays; read assignments, sessions,
--            feedback, and industry sessions for their own screenplays.
--   Readers: read screenplays assigned to them; full CRUD on own sessions
--            and feedback.
--   Industry: read screenplays with approved requests; CRUD on own industry
--             sessions.
--   Admins: unrestricted access to everything.
-- ============================================================================

-- ============================================================================
-- Step 1: SECURITY DEFINER helper functions
-- These functions run as the function owner (postgres) and therefore bypass
-- RLS on every table they read. This breaks the recursive policy chain
-- because RLS policies calling these functions never re-enter RLS evaluation.
-- ============================================================================

-- is_screenplay_writer: returns true if p_user_id is the writer of the
-- screenplay identified by p_screenplay_id. Reads the screenplays table
-- directly without RLS interference.
CREATE OR REPLACE FUNCTION public.is_screenplay_writer(p_screenplay_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM screenplays
    WHERE id = p_screenplay_id AND writer_id = p_user_id
  );
$$;

-- is_assigned_reader: returns true if p_user_id has an assignment (any
-- status) for the screenplay identified by p_screenplay_id. Reads the
-- assignments table directly without RLS interference.
CREATE OR REPLACE FUNCTION public.is_assigned_reader(p_screenplay_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM assignments
    WHERE screenplay_id = p_screenplay_id AND reader_id = p_user_id
  );
$$;

-- has_approved_industry_request: returns true if p_user_id (an industry
-- user) has a request with status 'approved' for the screenplay identified
-- by p_screenplay_id. Reads industry_requests directly without RLS.
CREATE OR REPLACE FUNCTION public.has_approved_industry_request(p_screenplay_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM industry_requests
    WHERE screenplay_id = p_screenplay_id
      AND industry_user_id = p_user_id
      AND status = 'approved'
  );
$$;

-- Grant EXECUTE on all helper functions to authenticated and anon roles
GRANT EXECUTE ON FUNCTION public.is_screenplay_writer(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_assigned_reader(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_approved_industry_request(uuid, uuid) TO authenticated, anon;

-- ============================================================================
-- Step 2: Recreate RLS policies for screenplays
-- Eliminates the EXISTS subqueries on assignments and industry_requests that
-- caused the recursion. Uses the new SECURITY DEFINER helper functions.
-- ============================================================================
DROP POLICY IF EXISTS select_screenplays ON public.screenplays;
DROP POLICY IF EXISTS insert_own_screenplays ON public.screenplays;
DROP POLICY IF EXISTS update_own_screenplays ON public.screenplays;
DROP POLICY IF EXISTS delete_own_screenplays ON public.screenplays;

-- SELECT: writers see their own, readers see assigned, industry sees
-- approved requests, admins see all. All cross-table checks go through
-- SECURITY DEFINER functions — no direct subqueries on RLS tables.
CREATE POLICY select_screenplays ON public.screenplays
  FOR SELECT TO authenticated
  USING (
    writer_id = auth.uid()
    OR is_admin()
    OR is_assigned_reader(id, auth.uid())
    OR has_approved_industry_request(id, auth.uid())
  );

-- INSERT: writers can create their own, admins can create any.
CREATE POLICY insert_own_screenplays ON public.screenplays
  FOR INSERT TO authenticated
  WITH CHECK (writer_id = auth.uid() OR is_admin());

-- UPDATE: writers can update their own, admins can update any.
CREATE POLICY update_own_screenplays ON public.screenplays
  FOR UPDATE TO authenticated
  USING (writer_id = auth.uid() OR is_admin())
  WITH CHECK (writer_id = auth.uid() OR is_admin());

-- DELETE: writers can delete their own, admins can delete any.
CREATE POLICY delete_own_screenplays ON public.screenplays
  FOR DELETE TO authenticated
  USING (writer_id = auth.uid() OR is_admin());

-- ============================================================================
-- Step 3: Recreate RLS policies for assignments
-- Eliminates the EXISTS subquery on screenplays. Uses is_screenplay_writer
-- to check ownership without triggering screenplays RLS.
-- ============================================================================
DROP POLICY IF EXISTS select_assignments ON public.assignments;
DROP POLICY IF EXISTS insert_assignments ON public.assignments;
DROP POLICY IF EXISTS update_assignments ON public.assignments;
DROP POLICY IF EXISTS delete_assignments ON public.assignments;

-- SELECT: readers see their own assignments, writers see assignments for
-- their own screenplays, admins see all.
CREATE POLICY select_assignments ON public.assignments
  FOR SELECT TO authenticated
  USING (
    reader_id = auth.uid()
    OR is_admin()
    OR is_screenplay_writer(screenplay_id, auth.uid())
  );

-- INSERT: readers can be assigned to themselves, writers can assign to
-- their own screenplays, admins can assign any.
CREATE POLICY insert_assignments ON public.assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    reader_id = auth.uid()
    OR is_admin()
    OR is_screenplay_writer(screenplay_id, auth.uid())
  );

-- UPDATE: readers can update their own assignments, writers can update
-- assignments for their own screenplays, admins can update any.
CREATE POLICY update_assignments ON public.assignments
  FOR UPDATE TO authenticated
  USING (
    reader_id = auth.uid()
    OR is_admin()
    OR is_screenplay_writer(screenplay_id, auth.uid())
  )
  WITH CHECK (
    reader_id = auth.uid()
    OR is_admin()
    OR is_screenplay_writer(screenplay_id, auth.uid())
  );

-- DELETE: writers can delete assignments for their own screenplays,
-- admins can delete any. (Readers cannot delete assignments.)
CREATE POLICY delete_assignments ON public.assignments
  FOR DELETE TO authenticated
  USING (
    is_admin()
    OR is_screenplay_writer(screenplay_id, auth.uid())
  );

-- ============================================================================
-- Step 4: Recreate RLS policies for reader_feedback
-- Eliminates the EXISTS subquery on screenplays. Uses is_screenplay_writer
-- for writer access, reader_id for reader self-access.
-- ============================================================================
DROP POLICY IF EXISTS select_reader_feedback ON public.reader_feedback;
DROP POLICY IF EXISTS insert_reader_feedback ON public.reader_feedback;
DROP POLICY IF EXISTS update_reader_feedback ON public.reader_feedback;
DROP POLICY IF EXISTS delete_reader_feedback ON public.reader_feedback;

-- SELECT: readers see their own feedback, writers see feedback for their
-- own screenplays, admins see all.
CREATE POLICY select_reader_feedback ON public.reader_feedback
  FOR SELECT TO authenticated
  USING (
    reader_id = auth.uid()
    OR is_admin()
    OR is_screenplay_writer(screenplay_id, auth.uid())
  );

-- INSERT: readers can submit their own feedback, admins can insert any.
CREATE POLICY insert_reader_feedback ON public.reader_feedback
  FOR INSERT TO authenticated
  WITH CHECK (reader_id = auth.uid() OR is_admin());

-- UPDATE: readers can update their own feedback, admins can update any.
CREATE POLICY update_reader_feedback ON public.reader_feedback
  FOR UPDATE TO authenticated
  USING (reader_id = auth.uid() OR is_admin())
  WITH CHECK (reader_id = auth.uid() OR is_admin());

-- DELETE: readers can delete their own feedback, admins can delete any.
CREATE POLICY delete_reader_feedback ON public.reader_feedback
  FOR DELETE TO authenticated
  USING (reader_id = auth.uid() OR is_admin());

-- ============================================================================
-- Step 5: Recreate RLS policies for reading_sessions
-- Eliminates the EXISTS subquery on screenplays. Uses is_screenplay_writer
-- for writer access, reader_id for reader self-access.
-- ============================================================================
DROP POLICY IF EXISTS select_reading_sessions ON public.reading_sessions;
DROP POLICY IF EXISTS insert_reading_sessions ON public.reading_sessions;
DROP POLICY IF EXISTS update_reading_sessions ON public.reading_sessions;
DROP POLICY IF EXISTS delete_reading_sessions ON public.reading_sessions;

-- SELECT: readers see their own sessions, writers see sessions for their
-- own screenplays, admins see all.
CREATE POLICY select_reading_sessions ON public.reading_sessions
  FOR SELECT TO authenticated
  USING (
    reader_id = auth.uid()
    OR is_admin()
    OR is_screenplay_writer(screenplay_id, auth.uid())
  );

-- INSERT: readers can create their own sessions, admins can insert any.
CREATE POLICY insert_reading_sessions ON public.reading_sessions
  FOR INSERT TO authenticated
  WITH CHECK (reader_id = auth.uid() OR is_admin());

-- UPDATE: readers can update their own sessions, admins can update any.
CREATE POLICY update_reading_sessions ON public.reading_sessions
  FOR UPDATE TO authenticated
  USING (reader_id = auth.uid() OR is_admin())
  WITH CHECK (reader_id = auth.uid() OR is_admin());

-- DELETE: readers can delete their own sessions, admins can delete any.
CREATE POLICY delete_reading_sessions ON public.reading_sessions
  FOR DELETE TO authenticated
  USING (reader_id = auth.uid() OR is_admin());

-- ============================================================================
-- Step 6: Recreate RLS policies for industry_reading_sessions
-- Eliminates the EXISTS subquery on screenplays. Uses is_screenplay_writer
-- for writer access, industry_user_id for industry self-access.
-- ============================================================================
DROP POLICY IF EXISTS select_own_industry_sessions ON public.industry_reading_sessions;
DROP POLICY IF EXISTS writer_select_industry_sessions ON public.industry_reading_sessions;
DROP POLICY IF EXISTS admin_select_industry_sessions ON public.industry_reading_sessions;
DROP POLICY IF EXISTS insert_own_industry_sessions ON public.industry_reading_sessions;
DROP POLICY IF EXISTS update_own_industry_sessions ON public.industry_reading_sessions;

-- SELECT: industry users see their own sessions, writers see sessions for
-- their own screenplays, admins see all. All cross-table checks use the
-- SECURITY DEFINER helper.
CREATE POLICY select_industry_reading_sessions ON public.industry_reading_sessions
  FOR SELECT TO authenticated
  USING (
    industry_user_id = auth.uid()
    OR is_admin()
    OR is_screenplay_writer(screenplay_id, auth.uid())
  );

-- INSERT: industry users can create their own sessions, admins can insert any.
CREATE POLICY insert_industry_reading_sessions ON public.industry_reading_sessions
  FOR INSERT TO authenticated
  WITH CHECK (industry_user_id = auth.uid() OR is_admin());

-- UPDATE: industry users can update their own sessions, admins can update any.
CREATE POLICY update_industry_reading_sessions ON public.industry_reading_sessions
  FOR UPDATE TO authenticated
  USING (industry_user_id = auth.uid() OR is_admin())
  WITH CHECK (industry_user_id = auth.uid() OR is_admin());
