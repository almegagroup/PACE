-- ============================================================================
-- PACE-ERP :: AUDIT DOMAIN
-- File    : A20260106_02_AUDIT_AUTH_LOGS_SERVICE_ROLE_POLICY.sql
-- Gate    : 0 / 4
-- Phase   : 0 / 4
-- Domain  : AUDIT / SECURITY
--
-- PURPOSE
-- -------
-- - Ensure backend (service_role) can INSERT audit logs
-- - Preserve RLS = ON (default deny for all others)
-- - Fix silent audit write failures
--
-- SAFE
-- ----
-- - Schema-only
-- - Replay-safe
-- - No data mutation
-- - Local + Production safe
--
-- SSOT
-- ----
-- audit.auth_audit_logs
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1️⃣ Ensure RLS is ENABLED (idempotent)
-- ---------------------------------------------------------------------------
ALTER TABLE audit.auth_audit_logs
ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2️⃣ Allow ONLY service_role to INSERT audit logs
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS service_role_can_insert_audit_logs
ON audit.auth_audit_logs;

CREATE POLICY service_role_can_insert_audit_logs
ON audit.auth_audit_logs
FOR INSERT
TO service_role
WITH CHECK (true);

COMMIT;
