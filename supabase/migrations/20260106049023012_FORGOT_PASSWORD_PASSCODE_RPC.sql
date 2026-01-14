-- ============================================================================
-- PACE-ERP :: AUTH
-- Gate    : 4
-- ID      : 4.4
-- Purpose : FORGOT PASSWORD & FORGOT PASSCODE
-- STATUS  : FINAL — PLUG & PLAY — ROOT CAUSE FIXED
--
-- GUARANTEE:
-- - pgcrypto.crypt() ALWAYS used explicitly
-- - Works under SECURITY DEFINER
-- - No "function crypt(text,text) does not exist"
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0️⃣ REQUIRED EXTENSION
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1️⃣ SESSION REVOKE HELPER (IDEMPOTENT)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION secure.revoke_all_auth_sessions(
  p_user_id uuid,
  p_reason text DEFAULT 'RESET'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = secure, public
AS $$
BEGIN
  UPDATE secure.auth_sessions
     SET status = 'REVOKED',
         revoked_at = now()
   WHERE user_id = p_user_id
     AND status = 'ACTIVE';

  UPDATE secure.erp_sessions
     SET revoked_at = now(),
         revoked_reason = COALESCE(p_reason, 'RESET')
   WHERE user_id = p_user_id
     AND revoked_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION secure.revoke_all_auth_sessions(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION secure.revoke_all_auth_sessions(uuid, text) TO service_role;

-- ============================================================================
-- 2️⃣ FORGOT PASSWORD
--    (VERIFY PASSCODE → SET NEW PASSWORD)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.forgot_password_complete(
  p_identifier text,
  p_passcode text,
  p_new_password text,
  p_identifier_hash text,
  p_secondary_identifier_hash text DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, secure, pgcrypto
AS $$
DECLARE
  v_user_id uuid;
  v_passcode_hash text;
BEGIN
  IF p_identifier IS NULL
     OR p_passcode IS NULL
     OR p_new_password IS NULL
     OR length(p_passcode) <> 8
     OR length(p_new_password) < 8
  THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT id
    INTO v_user_id
  FROM secure.auth_users
  WHERE lower(identifier) = lower(trim(p_identifier))
  LIMIT 1
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT passcode_hash
    INTO v_passcode_hash
  FROM secure.auth_credentials
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_passcode_hash IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  -- 🔐 VERIFY PASSCODE (ROOT FIX)
  IF pgcrypto.crypt(p_passcode, v_passcode_hash) <> v_passcode_hash THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  -- 🔐 SET NEW PASSWORD
  UPDATE secure.auth_credentials
     SET password_hash       = pgcrypto.crypt(p_new_password, pgcrypto.gen_salt('bf')),
         force_first_login   = false,
         password_updated_at = now()
   WHERE user_id = v_user_id;

  PERFORM secure.revoke_all_auth_sessions(v_user_id, 'FORGOT_PASSWORD');

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.forgot_password_complete(
  text, text, text, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.forgot_password_complete(
  text, text, text, text, text, text
) TO service_role;

-- ============================================================================
-- 3️⃣ FORGOT PASSCODE
--    (VERIFY PASSWORD → SET NEW PASSCODE)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.forgot_passcode_complete(
  p_identifier text,
  p_password text,
  p_new_passcode text,
  p_identifier_hash text,
  p_secondary_identifier_hash text DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = secure, public, pgcrypto
AS $$
DECLARE
  v_user_id uuid;
  v_password_hash text;
BEGIN
  IF p_identifier IS NULL
     OR p_password IS NULL
     OR p_new_passcode IS NULL
     OR length(p_new_passcode) <> 8
  THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT id
    INTO v_user_id
  FROM secure.auth_users
  WHERE lower(identifier) = lower(trim(p_identifier))
  LIMIT 1
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT password_hash
    INTO v_password_hash
  FROM secure.auth_credentials
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_password_hash IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  -- 🔐 VERIFY PASSWORD (ROOT FIX)
  IF pgcrypto.crypt(p_password, v_password_hash) <> v_password_hash THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  -- 🔐 SET NEW PASSCODE
  UPDATE secure.auth_credentials
     SET passcode_hash       = pgcrypto.crypt(p_new_passcode, pgcrypto.gen_salt('bf')),
         force_first_login   = false,
         passcode_updated_at = now()
   WHERE user_id = v_user_id;

  DELETE FROM secure.auth_trusted_devices
   WHERE user_id = v_user_id;

  PERFORM secure.revoke_all_auth_sessions(v_user_id, 'FORGOT_PASSCODE');

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.forgot_passcode_complete(
  text, text, text, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.forgot_passcode_complete(
  text, text, text, text, text, text
) TO service_role;

COMMIT;
