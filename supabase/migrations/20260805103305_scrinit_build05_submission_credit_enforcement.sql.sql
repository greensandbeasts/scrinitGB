-- ============================================================================
-- Build 05: Submission Credit Enforcement
--
-- Enforces upload credit requirements server-side via:
--   1. A SECURITY DEFINER function to atomically consume an upload credit
--   2. A BEFORE INSERT trigger on screenplays that blocks inserts without a credit
--
-- This prevents bypass via direct API requests or client-side manipulation.
-- The existing check_upload_eligibility() and consume_upload_credit() functions
-- from Build 03 are reused; this adds a trigger-level enforcement layer.
-- ============================================================================

-- ============================================================================
-- 1. SECURITY DEFINER: consume_upload_credit_for_screenplay
--    Atomically checks eligibility and consumes a credit. Returns true on success.
--    This is called by the BEFORE INSERT trigger.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.consume_upload_credit_for_screenplay()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance public.reader_contribution_balances;
  v_version_id uuid;
BEGIN
  -- Only enforce for published screenplays (drafts don't consume credits)
  IF NEW.status != 'published' THEN
    RETURN NEW;
  END IF;

  -- Get or create the writer's balance
  v_balance := public.get_or_create_balance(NEW.writer_id);

  -- Check free upload first
  IF NOT v_balance.free_upload_used THEN
    UPDATE public.reader_contribution_balances
    SET free_upload_used = true, updated_at = now()
    WHERE reader_id = NEW.writer_id;

    v_version_id := public.get_active_algorithm_version();
    INSERT INTO public.credit_transactions (reader_id, type, credits, screenplay_id, algorithm_version_id, note)
    VALUES (NEW.writer_id, 'free', 1, NEW.id, v_version_id, 'Free upload credit used for: ' || NEW.title);
    RETURN NEW;
  END IF;

  -- Check earned credits
  IF v_balance.upload_credits > 0 THEN
    UPDATE public.reader_contribution_balances
    SET upload_credits = upload_credits - 1, updated_at = now()
    WHERE reader_id = NEW.writer_id;

    v_version_id := public.get_active_algorithm_version();
    INSERT INTO public.credit_transactions (reader_id, type, credits, points_spent, screenplay_id, algorithm_version_id, note)
    VALUES (NEW.writer_id, 'spent', 1, 0, NEW.id, v_version_id, 'Earned upload credit spent for: ' || NEW.title);
    RETURN NEW;
  END IF;

  -- No credits available — block the insert
  RAISE EXCEPTION 'No upload credits available. Earn contribution points by reading and reviewing screenplays.';
END;
$$;

-- ============================================================================
-- 2. BEFORE INSERT trigger on screenplays
-- ============================================================================
DROP TRIGGER IF EXISTS enforce_upload_credit ON public.screenplays;
CREATE TRIGGER enforce_upload_credit
  BEFORE INSERT ON public.screenplays
  FOR EACH ROW
  EXECUTE FUNCTION public.consume_upload_credit_for_screenplay();
