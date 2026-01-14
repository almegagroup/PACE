-- ============================================================================
-- PACE-ERP :: AUTH
-- Gate   : 4.5C
-- Patch  : FIX_FIRST_LOGIN_RESET_ELIGIBILITY
-- File   : 20260108_gate45_fix_first_login_reset_eligibility.sql
--
-- PURPOSE:
-- Fix reset first-login eligibility rules.
--
-- FINAL SSOT RULE:
-- 1) Signup flow:
--    auth_signup_requests.state = SET_FIRST_LOGIN
--
-- 2) Reset flow:
--    auth_reset_requests.state = APPROVED
--    AND secure.auth_users.state = FIRST_LOGIN_REQUIRED
--
-- This avoids signup/reset overlap ambiguity.
--
-- SAFE:
-- - Does NOT break signup first-login
-- - Does NOT affect role / ACL / permissions
-- - Backward compatible
-- ============================================================================

BEGIN;

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
    v_reset_id   uuid;
    v_user_state secure.auth_user_state;
BEGIN
    -- -----------------------------------------------------------------------
    -- Basic validation
    -- -----------------------------------------------------------------------
    IF p_phone IS NULL OR length(trim(p_phone)) = 0 THEN
        RETURN jsonb_build_object('ok', false);
    END IF;

    IF p_new_passcode IS NULL OR length(p_new_passcode) <> 8 THEN
        RETURN jsonb_build_object('ok', false);
    END IF;

    IF p_new_password IS NULL OR length(p_new_password) < 8 THEN
        RETURN jsonb_build_object('ok', false);
    END IF;

    v_identifier := trim(p_phone) || '@pace.in';

    -- -----------------------------------------------------------------------
    -- Lock user
    -- -----------------------------------------------------------------------
    SELECT id, state
    INTO v_user_id, v_user_state
    FROM secure.auth_users
    WHERE identifier = v_identifier
    LIMIT 1
    FOR UPDATE;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false);
    END IF;

    -- -----------------------------------------------------------------------
    -- 1️⃣ SIGNUP FIRST LOGIN (HIGHEST PRIORITY)
    -- -----------------------------------------------------------------------
    SELECT id
    INTO v_req_id
    FROM public.auth_signup_requests
    WHERE phone = trim(p_phone)
      AND state = 'SET_FIRST_LOGIN'
    LIMIT 1
    FOR UPDATE;

    IF v_req_id IS NOT NULL THEN
        PERFORM secure.reset_auth_credentials(
            v_user_id,
            p_new_password,
            p_new_passcode
        );

        UPDATE secure.auth_users
        SET state = 'ACTIVE',
            phone = trim(p_phone),
            updated_at = now()
        WHERE id = v_user_id;

        UPDATE public.auth_signup_requests
        SET state = 'CONSUMED',
            consumed_by = 'FIRST_LOGIN',
            consumed_at = now()
        WHERE id = v_req_id;

        RETURN jsonb_build_object('ok', true, 'flow', 'SIGNUP');
    END IF;

    -- -----------------------------------------------------------------------
    -- 2️⃣ RESET FIRST LOGIN (STRICT ELIGIBILITY)
    -- -----------------------------------------------------------------------
    IF v_user_state <> 'FIRST_LOGIN_REQUIRED' THEN
        RETURN jsonb_build_object('ok', false);
    END IF;

    SELECT id
    INTO v_reset_id
    FROM public.auth_reset_requests
    WHERE user_id = v_user_id
      AND state = 'APPROVED'
    ORDER BY reviewed_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_reset_id IS NULL THEN
        RETURN jsonb_build_object('ok', false);
    END IF;

    PERFORM secure.reset_auth_credentials(
        v_user_id,
        p_new_password,
        p_new_passcode
    );

    UPDATE public.auth_reset_requests
    SET state = 'EXECUTED',
        executed_at = now()
    WHERE id = v_reset_id;

    UPDATE secure.auth_users
    SET state = 'ACTIVE',
        phone = trim(p_phone),
        updated_at = now()
    WHERE id = v_user_id;

    RETURN jsonb_build_object('ok', true, 'flow', 'RESET');

END;
$$;

COMMIT;
