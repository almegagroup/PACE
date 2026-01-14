-- ============================================================================
-- PACE-ERP :: AUTH
-- Patch  : FINAL_FIX_RESET_STATE
-- Purpose:
--   1) Ensure reset approval ALWAYS results in RESET_REQUIRED
--   2) Ensure first-login flow is NEVER affected
-- Status : FINAL / LOCKED / SAFE
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1️⃣ DATA FIX
-- Any user who has an APPROVED reset request but is wrongly
-- in FIRST_LOGIN_REQUIRED must be corrected to RESET_REQUIRED
-- ---------------------------------------------------------------------------

UPDATE secure.auth_users u
SET state = 'RESET_REQUIRED',
    updated_at = NOW()
WHERE state = 'FIRST_LOGIN_REQUIRED'
  AND EXISTS (
    SELECT 1
    FROM public.auth_reset_requests r
    WHERE r.user_id = u.id
      AND r.state = 'APPROVED'
  );

-- ---------------------------------------------------------------------------
-- 2️⃣ HARD DB GUARANTEE (FUTURE SAFE)
-- If ANY logic ever tries to put a reset-approved user into
-- FIRST_LOGIN_REQUIRED, DB will forcibly correct it.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_reset_state_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- This rule applies ONLY if a reset is approved
  IF NEW.state = 'FIRST_LOGIN_REQUIRED'
     AND EXISTS (
       SELECT 1
       FROM public.auth_reset_requests r
       WHERE r.user_id = NEW.id
         AND r.state = 'APPROVED'
     ) THEN
    NEW.state := 'RESET_REQUIRED';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_reset_state
ON secure.auth_users;

CREATE TRIGGER trg_enforce_reset_state
BEFORE UPDATE ON secure.auth_users
FOR EACH ROW
EXECUTE FUNCTION enforce_reset_state_only();

COMMIT;
