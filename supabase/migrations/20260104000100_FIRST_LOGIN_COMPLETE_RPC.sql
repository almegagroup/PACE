-- =====================================================================
-- PACE-ERP :: AUTH
-- RPC    : first_login_complete
-- Gate   : 4.3B
-- Purpose:
--   - Signup-based FIRST LOGIN only
--   - Inline credential rotation (pgcrypto)
--   - Mandatory AUDIT logging (only when user is known)
--   - NO reset / forgot / admin coupling
-- Status : FINAL / LOCKED / PRODUCTION SAFE
-- =====================================================================

DROP FUNCTION IF EXISTS public.first_login_complete(
  text, text, text, text, text, text
);

CREATE FUNCTION public.first_login_complete(
  p_phone                     text,
  p_new_passcode              text,
  p_new_password              text,
  p_identifier_hash           text,
  p_secondary_identifier_hash text DEFAULT NULL,
  p_request_id                text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, secure, audit, extensions
AS $$
DECLARE
  v_user_id   uuid;
  v_signup_id uuid;
BEGIN
  -- ------------------------------------------------------------
  -- 1️⃣ Basic validation (NO AUDIT – pre-user, spam-safe)
  -- ------------------------------------------------------------
  IF p_phone IS NULL
     OR length(trim(p_phone)) = 0
     OR p_new_passcode IS NULL
     OR length(p_new_passcode) <> 8
     OR p_new_password IS NULL
     OR length(p_new_password) < 8
  THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  -- ------------------------------------------------------------
  -- 2️⃣ Lock user (must be FIRST_LOGIN_REQUIRED)
  -- ------------------------------------------------------------
  SELECT id
    INTO v_user_id
  FROM secure.auth_users
  WHERE identifier = trim(p_phone) || '@pace.in'
    AND state = 'FIRST_LOGIN_REQUIRED'
  LIMIT 1
  FOR UPDATE;

  -- ❌ Unknown / random phone → NO AUDIT
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  -- ------------------------------------------------------------
  -- 3️⃣ Validate signup request (audit-worthy FAIL)
  -- ------------------------------------------------------------
  SELECT id
    INTO v_signup_id
  FROM public.auth_signup_requests
  WHERE phone = trim(p_phone)
    AND state = 'SET_FIRST_LOGIN'
  LIMIT 1
  FOR UPDATE;

  IF v_signup_id IS NULL THEN
    INSERT INTO audit.auth_audit_logs (
      event_type,
      identifier_hash,
      secondary_identifier_hash,
      target_id,
      result,
      gate,
      source,
      request_id
    ) VALUES (
      'FIRST_LOGIN_COMPLETE',
      p_identifier_hash,
      p_secondary_identifier_hash,
      v_user_id,
      'FAILED',
      4,
      'auth',
      p_request_id
    );
    RETURN jsonb_build_object('ok', false);
  END IF;

  -- ------------------------------------------------------------
  -- 4️⃣ Guard: credentials MUST exist
  -- ------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1
    FROM secure.auth_credentials
    WHERE user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'AUTH_CREDENTIALS_MISSING';
  END IF;

  -- ------------------------------------------------------------
  -- 5️⃣ Rotate credentials (INLINE, CANONICAL)
  -- ------------------------------------------------------------
  UPDATE secure.auth_credentials
     SET password_hash       = crypt(p_new_password, gen_salt('bf')),
         passcode_hash       = crypt(p_new_passcode, gen_salt('bf')),
         force_first_login   = false,
         password_updated_at = now(),
         passcode_updated_at = now()
   WHERE user_id = v_user_id;

  -- ------------------------------------------------------------
  -- 6️⃣ Activate user
  -- ------------------------------------------------------------
  UPDATE secure.auth_users
     SET state      = 'ACTIVE',
         phone      = trim(p_phone),
         is_active  = true,
         updated_at = now()
   WHERE id = v_user_id;

  -- ------------------------------------------------------------
  -- 7️⃣ Consume signup request
  -- ------------------------------------------------------------
  UPDATE public.auth_signup_requests
     SET state       = 'CONSUMED',
         consumed_by = 'FIRST_LOGIN',
         consumed_at = now()
   WHERE id = v_signup_id;

  -- ------------------------------------------------------------
  -- 8️⃣ AUDIT SUCCESS (MANDATORY)
  -- ------------------------------------------------------------
  INSERT INTO audit.auth_audit_logs (
    event_type,
    identifier_hash,
    secondary_identifier_hash,
    target_id,
    result,
    gate,
    source,
    request_id
  ) VALUES (
    'FIRST_LOGIN_COMPLETE',
    p_identifier_hash,
    p_secondary_identifier_hash,
    v_user_id,
    'OK',
    4,
    'auth',
    p_request_id
  );

  RETURN jsonb_build_object('ok', true, 'flow', 'SIGNUP');
END;
$$;
