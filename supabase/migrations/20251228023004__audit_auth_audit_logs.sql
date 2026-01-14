-- ============================================================================
-- PACE-ERP :: AUDIT DOMAIN
-- File-ID : ID-2.7 + ID-4.2B
-- Gate    : 2 + 4
-- Phase   : 2 + 4
-- Domain  : AUDIT / GOVERNANCE
-- Purpose :
--   - Single append-only audit log for AUTH & SA governance
--   - Covers login events + signup approval lifecycle
--   - SSOT for all auth-level audit trails
-- Status  : FINAL – FROZEN
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1️⃣ Ensure AUDIT schema
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS audit;
COMMENT ON SCHEMA audit IS
'Append-only audit logs and security governance events. SSOT.';

-- ---------------------------------------------------------------------------
-- 2️⃣ auth_audit_logs table (canonical)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit.auth_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- WHAT happened
  event_type TEXT NOT NULL,

  -- WHO did it (hashed identifiers only)
  identifier_hash TEXT,
  secondary_identifier_hash TEXT,

  -- Target entity (signup_request_id / user_id etc.)
  target_id UUID,

  -- Result semantics
  result TEXT NOT NULL CHECK (result IN ('OK','FAILED','BLOCKED')),

  -- Traceability
  gate INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'auth',
  request_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE audit.auth_audit_logs IS
'SSOT audit log for AUTH events and SA governance actions.
NO plaintext identifiers. Append-only by contract.';

-- ---------------------------------------------------------------------------
-- 3️⃣ Indexes (read-only diagnostics / RCA)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_audit_event_type
  ON audit.auth_audit_logs(event_type);

CREATE INDEX IF NOT EXISTS idx_audit_created_at
  ON audit.auth_audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_request_id
  ON audit.auth_audit_logs(request_id);

CREATE INDEX IF NOT EXISTS idx_audit_identifier_hash
  ON audit.auth_audit_logs(identifier_hash);

-- ---------------------------------------------------------------------------
-- 4️⃣ RLS – STRICT
-- ---------------------------------------------------------------------------
ALTER TABLE audit.auth_audit_logs ENABLE ROW LEVEL SECURITY;

-- Nobody from client side ever
REVOKE ALL ON TABLE audit.auth_audit_logs FROM anon;
REVOKE ALL ON TABLE audit.auth_audit_logs FROM authenticated;

-- Backend service role ONLY
GRANT SELECT, INSERT
  ON TABLE audit.auth_audit_logs
  TO service_role;

-- Explicitly forbid UPDATE / DELETE (append-only guarantee)
REVOKE UPDATE, DELETE
  ON TABLE audit.auth_audit_logs
  FROM service_role;

COMMIT;
