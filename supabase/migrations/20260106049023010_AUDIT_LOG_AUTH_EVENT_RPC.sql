-- ============================================================================
-- PACE-ERP :: AUDIT DOMAIN
-- File    : A20260106_03_PUBLIC_AUDIT_LOG_AUTH_EVENT_RPC.sql
-- Gate    : 4
-- Phase   : 4
-- Domain  : AUDIT / SECURITY
--
-- PURPOSE
-- -------
-- - Provide a PUBLIC RPC for audit logging (PostgREST-safe)
-- - Internally write to audit.auth_audit_logs (hidden schema)
-- - Permanently eliminate "Invalid schema: audit" errors
--
-- SAFE
-- ----
-- - No data mutation
-- - Idempotent
-- - Local + Production safe
--
-- SSOT
-- ----
-- public.log_auth_event()
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1️⃣ Create / Replace PUBLIC RPC (PostgREST exposed)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_auth_event(
  p_event_type text,
  p_identifier_hash text,
  p_result text,
  p_gate int,
  p_source text,
  p_secondary_identifier_hash text DEFAULT NULL,
  p_target_id uuid DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = audit
AS $$
BEGIN
  INSERT INTO audit.auth_audit_logs (
    event_type,
    identifier_hash,
    secondary_identifier_hash,
    target_id,
    request_id,
    result,
    gate,
    source
  )
  VALUES (
    p_event_type,
    p_identifier_hash,
    p_secondary_identifier_hash,
    p_target_id,
    p_request_id,
    p_result,
    p_gate,
    p_source
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 2️⃣ Lock down execution (only backend / service_role)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.log_auth_event(
  text,
  text,
  text,
  int,
  text,
  text,
  uuid,
  text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.log_auth_event(
  text,
  text,
  text,
  int,
  text,
  text,
  uuid,
  text
) TO service_role;

COMMIT;
