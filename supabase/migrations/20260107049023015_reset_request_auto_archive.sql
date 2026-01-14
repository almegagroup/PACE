-- ============================================================================
-- PATCH : RESET_REQUEST_ARCHIVE_GUARD
-- Purpose:
--   Ensure only ONE active reset per user
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION archive_old_reset_requests()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- When a reset is APPROVED,
  -- archive any older APPROVED/REQUESTED resets
  IF NEW.state = 'APPROVED' THEN
    UPDATE public.auth_reset_requests
    SET state = 'EXECUTED',
        executed_at = NOW()
    WHERE user_id = NEW.user_id
      AND id <> NEW.id
      AND state IN ('APPROVED', 'REQUESTED');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_archive_old_resets
ON public.auth_reset_requests;

CREATE TRIGGER trg_archive_old_resets
AFTER UPDATE ON public.auth_reset_requests
FOR EACH ROW
EXECUTE FUNCTION archive_old_reset_requests();

COMMIT;
