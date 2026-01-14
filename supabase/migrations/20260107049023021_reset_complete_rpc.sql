-- ============================================================================
-- PACE-ERP :: AUTH
-- Gate   : 4.5B
-- RPC    : reset_complete
-- Purpose:
--   Complete admin-approved reset by:
--   - setting new password + passcode in auth_credentials
--   - activating user account
--   - marking ONLY the latest approved reset as EXECUTED
-- Status : FINAL / LOCKED / PRODUCTION SAFE
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.reset_complete(
  p_phone TEXT,
  p_new_password TEXT,
  p_new_passcode TEXT,
  p_identifier_hash TEXT,
  p_request_id TEXT DEFAULT NULL
)
RETURNS TABLE(ok BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_reset_id UUID;
BEGIN
  -- -------------------------------------------------------------------------
  -- 1️⃣ Load user (lock row)
  -- -------------------------------------------------------------------------
  SELECT id
  INTO v_user_id
  FROM secure.auth_users
  WHERE phone = p_phone
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false;
    RETURN;
  END IF;

  -- -------------------------------------------------------------------------
  -- 2️⃣ User MUST be in RESET_REQUIRED
  -- -------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1
    FROM secure.auth_users
    WHERE id = v_user_id
      AND state = 'RESET_REQUIRED'
  ) THEN
    RETURN QUERY SELECT false;
    RETURN;
  END IF;

  -- -------------------------------------------------------------------------
  -- 3️⃣ Pick ONLY latest APPROVED reset (ignore old EXECUTED)
  -- -------------------------------------------------------------------------
  SELECT id
  INTO v_reset_id
  FROM public.auth_reset_requests
  WHERE user_id = v_user_id
    AND state = 'APPROVED'
  ORDER BY requested_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_reset_id IS NULL THEN
    RETURN QUERY SELECT false;
    RETURN;
  END IF;

  -- -------------------------------------------------------------------------
  -- 4️⃣ Update credentials
  -- -------------------------------------------------------------------------
  UPDATE secure.auth_credentials
  SET
    password_hash = crypt(p_new_password, gen_salt('bf')),
    passcode_hash = crypt(p_new_passcode, gen_salt('bf')),
    password_updated_at = NOW(),
    passcode_updated_at = NOW(),
    force_first_login = false
  WHERE user_id = v_user_id;

  -- -------------------------------------------------------------------------
  -- 5️⃣ Activate user
  -- -------------------------------------------------------------------------
  UPDATE secure.auth_users
  SET
    state = 'ACTIVE',
    updated_at = NOW()
  WHERE id = v_user_id;

  -- -------------------------------------------------------------------------
  -- 6️⃣ Finalize THIS reset only
  -- -------------------------------------------------------------------------
  UPDATE public.auth_reset_requests
  SET
    state = 'EXECUTED',
    executed_at = NOW()
  WHERE id = v_reset_id;

  RETURN QUERY SELECT true;
END;
$$;

COMMIT;
