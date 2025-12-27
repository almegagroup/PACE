-- ============================================================================
-- GATE-3 FINAL MIGRATION
-- ERP Session Authority (SSOT)
-- One-shot, reset-safe, production-safe
-- ============================================================================

BEGIN;

-- 1️⃣ Ensure secure schema exists (Gate-0 dependency, defensive)
CREATE SCHEMA IF NOT EXISTS secure;

-- 2️⃣ Session state ENUM (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'erp_session_state'
  ) THEN
    CREATE TYPE erp_session_state AS ENUM (
      'CREATED',
      'ACTIVE',
      'IDLE',
      'EXPIRED',
      'REVOKED',
      'DEAD'
    );
  END IF;
END$$;

-- 3️⃣ ERP session table (authoritative)
CREATE TABLE IF NOT EXISTS secure.erp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,

  state erp_session_state NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,

  revoked_at timestamptz,
  revoked_reason text,
  revoked_by text,

  device_tag text,
  request_id text
);

-- 4️⃣ Indexes
CREATE INDEX IF NOT EXISTS idx_erp_sessions_user
  ON secure.erp_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_erp_sessions_state
  ON secure.erp_sessions (state);

CREATE INDEX IF NOT EXISTS idx_erp_sessions_expiry
  ON secure.erp_sessions (expires_at);

-- 5️⃣ RLS hardening (Gate-0 rules)
ALTER TABLE secure.erp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE secure.erp_sessions FORCE ROW LEVEL SECURITY;

COMMIT;
