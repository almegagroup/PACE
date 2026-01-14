-- ============================================================================
-- PACE-ERP :: AUTH
-- Gate   : 4.5B
-- Patch  : FIX_RESET_STATE_TRANSITION
-- Purpose:
--   Allow APPROVED → EXECUTED for reset completion
--   Prevent any mutation after EXECUTED
-- Status : FINAL / PRODUCTION SAFE
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Replace trigger function with correct state machine
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_reset_rereview()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- 🔒 Hard lock: once EXECUTED, no further changes allowed
  IF OLD.state = 'EXECUTED' THEN
    RAISE EXCEPTION 'Reset request already finalized';
  END IF;

  -- ❌ Prevent invalid transitions from APPROVED / REJECTED
  IF OLD.state IN ('APPROVED', 'REJECTED')
     AND NEW.state NOT IN ('APPROVED', 'EXECUTED', 'REJECTED') THEN
    RAISE EXCEPTION 'Invalid reset state transition';
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
