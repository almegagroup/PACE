-- ============================================================================
-- PACE-ERP :: AUTH DOMAIN
-- Gate   : 4.5
-- Patch  : AUTH_RESET_REQUEST_RPC (SSOT)
-- Purpose: Provide a secure RPC for public reset-request flow
-- Notes  :
-- - Edge Functions cannot read secure.* tables via PostgREST.
-- - This RPC is SECURITY DEFINER and is the ONLY allowed bridge.
-- - Enumeration-safe: caller always receives ok=true even if user not found.
-- - Idempotent: prevents duplicate REQUESTED/APPROVED for same user.
-- ============================================================================

BEGIN;

-- 1) RPC: request_auth_reset
-- ---------------------------------------------------------------------------
-- Contract:
--   input : p_identifier (canonical identifier)
--   output: json { ok: boolean }
-- Behavior:
--   - If user not found: ok=true (enumeration-safe)
--   - If existing REQUESTED/APPROVED: ok=true (idempotent)
--   - Else:
--       * set secure.auth_users.state = RESET_REQUIRED
--       * revoke sessions (best effort; optional if RPC exists)
--       * insert public.auth_reset_requests state=REQUESTED
--       * audit best-effort (optional: if audit RPC exists)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.request_auth_reset(p_identifier text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, secure
AS $$
DECLARE
  v_user_id uuid;
  v_existing uuid;
BEGIN
  -- Silent lookup (secure schema)
  SELECT u.id INTO v_user_id
  FROM secure.auth_users u
  WHERE u.identifier = lower(trim(p_identifier))
  LIMIT 1;

  -- Enumeration-safe: if no user, still OK
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', true);
  END IF;

  -- Idempotency: block duplicates for REQUESTED/APPROVED
  SELECT r.id INTO v_existing
  FROM public.auth_reset_requests r
  WHERE r.user_id = v_user_id
    AND r.state IN ('REQUESTED', 'APPROVED')
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN json_build_object('ok', true);
  END IF;

  -- Immediate lock: RESET_REQUIRED (SSOT)
  UPDATE secure.auth_users
  SET state = 'RESET_REQUIRED',
      updated_at = now()
  WHERE id = v_user_id;

  -- Best-effort session revoke (only if RPC exists)
  BEGIN
    PERFORM public.revoke_all_auth_sessions(p_user_id := v_user_id, p_reason := 'RESET_REQUEST');
  EXCEPTION WHEN undefined_function THEN
    -- ignore
    NULL;
  END;

  -- Insert reset request
  INSERT INTO public.auth_reset_requests (user_id, identifier, state)
  VALUES (v_user_id, p_identifier, 'REQUESTED');

  -- Best-effort audit (only if audit RPC exists)
  BEGIN
    PERFORM public.log_auth_event(
      p_event_type := 'RESET_REQUEST_CREATED',
      p_identifier_hash := NULL,
      p_secondary_identifier_hash := NULL,
      p_target_id := v_user_id,
      p_request_id := NULL,
      p_result := 'OK',
      p_gate := 4,
      p_source := 'auth'
    );
  EXCEPTION WHEN undefined_function THEN
    -- ignore
    NULL;
  END;

  RETURN json_build_object('ok', true);
END;
$$;

-- 2) Grant execute
-- ---------------------------------------------------------------------------
-- Edge Functions using service_role can call RPC anyway,
-- but we explicitly grant for clarity and future-proofing.
GRANT EXECUTE ON FUNCTION public.request_auth_reset(text) TO service_role;

COMMIT;
