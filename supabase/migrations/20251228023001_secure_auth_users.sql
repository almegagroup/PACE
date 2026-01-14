-- ============================================================================
-- Migration: FINALIZE secure.auth_users (Gate-4 Canonical)
-- Gate     : 4
-- Phase    : 4
-- Domain   : AUTH / SECURITY
-- Purpose  :
--   - Single canonical identity table for ALL users
--   - SA / GA (Admin Universe) + ACL users
--   - NO plaintext credentials
--   - ACL data explicitly NOT stored here
--
-- COMPLIANT WITH:
--   - SRIYA-0504 ACL MASTER DESIGN V1.2
--   - Dual Universe Model (ADMIN vs ACL)
--
-- SAFE FOR:
--   - Fresh database
--   - Existing database (ALTER-based)
--   - Local + Production
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Ensure required extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Ensure schema exists
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS secure;

-- ---------------------------------------------------------------------------
-- Base table (minimal safety for fresh DB only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS secure.auth_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------------
-- FINAL column set (ALTER-safe, idempotent)
-- ---------------------------------------------------------------------------
ALTER TABLE secure.auth_users
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,

  -- Security credentials (HASHED ONLY)
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS passcode_hash TEXT,

  -- Lifecycle
  ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'FIRST_LOGIN_REQUIRED',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Admin universe flags
  ADD COLUMN IF NOT EXISTS is_sa BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_ga BOOLEAN NOT NULL DEFAULT FALSE,

  -- Role metadata (authoritative)
  ADD COLUMN IF NOT EXISTS role_code TEXT NOT NULL DEFAULT 'L1_USER',
  ADD COLUMN IF NOT EXISTS role_rank INTEGER NOT NULL DEFAULT 10,

  -- Org context (NULL for SA / GA by design)
  ADD COLUMN IF NOT EXISTS hr_company_id UUID,
  ADD COLUMN IF NOT EXISTS department_code TEXT,

  -- Audit
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ---------------------------------------------------------------------------
-- Data integrity constraint (ADMIN vs ACL universe)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_auth_users_admin_universe'
  ) THEN
    ALTER TABLE secure.auth_users
      ADD CONSTRAINT chk_auth_users_admin_universe
      CHECK (
        -- SA (ERP GOD)
        (is_sa = TRUE  AND is_ga = FALSE AND role_code = 'SA' AND role_rank = 999)

        OR
        -- GA (GROUP GOD – future)
        (is_ga = TRUE  AND is_sa = FALSE AND role_code = 'GA' AND role_rank = 888)

        OR
        -- ACL Universe users
        (is_sa = FALSE AND is_ga = FALSE AND role_rank < 888)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Indexes (performance + lookup)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_auth_users_identifier
  ON secure.auth_users (identifier);

CREATE INDEX IF NOT EXISTS idx_auth_users_role_code
  ON secure.auth_users (role_code);

CREATE INDEX IF NOT EXISTS idx_auth_users_role_rank
  ON secure.auth_users (role_rank);

CREATE INDEX IF NOT EXISTS idx_auth_users_state
  ON secure.auth_users (state);

-- ---------------------------------------------------------------------------
-- RLS: Auth domain internal ONLY
-- ---------------------------------------------------------------------------
ALTER TABLE secure.auth_users ENABLE ROW LEVEL SECURITY;

-- Revoke all public access
REVOKE ALL ON TABLE secure.auth_users FROM anon;
REVOKE ALL ON TABLE secure.auth_users FROM authenticated;

-- Service role full control (intentional bypass)
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE secure.auth_users
  TO service_role;

COMMIT;
