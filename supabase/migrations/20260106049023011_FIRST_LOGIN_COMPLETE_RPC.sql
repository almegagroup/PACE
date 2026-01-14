-- ============================================================================
-- PACE-ERP :: AUTH
-- Gate : 4
-- ID   : 4.3B
-- Purpose : FIRST LOGIN COMPLETION (CANONICAL, ONE-SHOT)
--
-- LOCKED RULES:
-- - Hashing ONLY inside secure schema
-- - public schema = orchestration only
-- - Reuse existing credential philosophy
-- - Signup lifecycle: SET_FIRST_LOGIN -> CONSUMED
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) EXTENSION (required for secure crypto RPC)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 2) SECURE RPC : reset_auth_credentials
-- (DB-side hashing, SSOT for secrets)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION secure.reset_auth_credentials(
    p_user_id        uuid,
    p_new_password   text,
    p_new_passcode   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = secure, extensions
AS $$
BEGIN
    UPDATE secure.auth_credentials
    SET
        password_hash        = crypt(p_new_password, gen_salt('bf')),
        passcode_hash        = crypt(p_new_passcode, gen_salt('bf')),
        force_first_login    = false,
        password_updated_at = now(),
        passcode_updated_at = now()
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'CREDENTIALS_NOT_FOUND';
    END IF;
END;
$$;

REVOKE ALL
ON FUNCTION secure.reset_auth_credentials(uuid, text, text)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION secure.reset_auth_credentials(uuid, text, text)
TO service_role;

-- ---------------------------------------------------------------------------
-- 3) PUBLIC RPC : first_login_complete
-- (NO crypto here, orchestration + state transitions only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.first_login_complete(
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
SET search_path = public, secure
AS $$
DECLARE
    v_identifier text;
    v_user_id    uuid;
    v_req_id     uuid;
BEGIN
    -- Basic validation
    IF p_phone IS NULL OR length(trim(p_phone)) = 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PHONE');
    END IF;

    IF p_new_passcode IS NULL OR length(p_new_passcode) <> 8 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PASSCODE_LEN');
    END IF;

    IF p_new_password IS NULL OR length(p_new_password) < 8 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PASSWORD_LEN');
    END IF;

    v_identifier := trim(p_phone) || '@pace.in';

    -- Lock eligible signup request
    SELECT id
    INTO v_req_id
    FROM public.auth_signup_requests
    WHERE phone = trim(p_phone)
      AND state = 'SET_FIRST_LOGIN'
    LIMIT 1
    FOR UPDATE;

    IF v_req_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'NO_ELIGIBLE_SIGNUP_REQUEST');
    END IF;

    -- Lock user
    SELECT id
    INTO v_user_id
    FROM secure.auth_users
    WHERE identifier = v_identifier
    LIMIT 1
    FOR UPDATE;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'USER_NOT_FOUND');
    END IF;

    -- Reset credentials (secure RPC)
    PERFORM secure.reset_auth_credentials(
        v_user_id,
        p_new_password,
        p_new_passcode
    );

    -- Activate user + persist phone
    UPDATE secure.auth_users
    SET
        state      = 'ACTIVE',
        phone      = trim(p_phone),
        updated_at = now()
    WHERE id = v_user_id;

    -- Consume signup request
    UPDATE public.auth_signup_requests
    SET
        state        = 'CONSUMED',
        consumed_by = 'FIRST_LOGIN',
        consumed_at = now()
    WHERE id = v_req_id;

    -- Audit (best effort, never block)
    BEGIN
        PERFORM public.log_auth_event(
            'FIRST_LOGIN_COMPLETED',
            p_identifier_hash,
            'OK',
            4,
            'first_login',
            p_secondary_identifier_hash,
            v_user_id,
            p_request_id
        );
    EXCEPTION
        WHEN others THEN
            NULL;
    END;

    RETURN jsonb_build_object(
        'ok', true,
        'action', 'FIRST_LOGIN_COMPLETED',
        'identifier', v_identifier,
        'user_id', v_user_id,
        'signup_request_id', v_req_id
    );
END;
$$;

REVOKE ALL
ON FUNCTION public.first_login_complete(
    text, text, text, text, text, text
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.first_login_complete(
    text, text, text, text, text, text
)
TO service_role;

COMMIT;
