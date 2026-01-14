BEGIN;

-- ============================================================================
-- PATCH : Gate-4.4 Forgot Flow Resolver Fix
-- Purpose : Fix crypt() resolution via correct schema
-- Scope   : Function-level hot patch only
-- Safety  : Data-safe, migration-safe, SSOT-compliant
-- ============================================================================

-- ---------------------------------------------------------------------------
-- FORGOT PASSWORD (PATCHED)
-- ---------------------------------------------------------------------------
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
SET search_path = secure, extensions, public
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

  -- VERIFY EXISTING PASSCODE
  IF crypt(p_passcode, v_passcode_hash) <> v_passcode_hash THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  -- SET NEW PASSWORD
  UPDATE secure.auth_credentials
     SET password_hash       = crypt(p_new_password, gen_salt('bf')),
         force_first_login   = false,
         password_updated_at = now()
   WHERE user_id = v_user_id;

  PERFORM secure.revoke_all_auth_sessions(v_user_id, 'FORGOT_PASSWORD');

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- FORGOT PASSCODE (PATCHED)
-- ---------------------------------------------------------------------------
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
SET search_path = secure, extensions, public
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

  -- VERIFY EXISTING PASSWORD
  IF crypt(p_password, v_password_hash) <> v_password_hash THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  -- SET NEW PASSCODE
  UPDATE secure.auth_credentials
     SET passcode_hash       = crypt(p_new_passcode, gen_salt('bf')),
         force_first_login   = false,
         passcode_updated_at = now()
   WHERE user_id = v_user_id;

  DELETE FROM secure.auth_trusted_devices
   WHERE user_id = v_user_id;

  PERFORM secure.revoke_all_auth_sessions(v_user_id, 'FORGOT_PASSCODE');

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMIT;
