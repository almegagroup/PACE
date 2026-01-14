-- ============================================================================
-- PACE-ERP :: AUTH DOMAIN (CANONICAL)
-- File    : A20251229_01_AUTH_CANONICAL_CREDENTIALS.sql
-- Gate    : 4
-- Phase   : 4
-- Domain  : AUTH / SECURITY
--
-- PURPOSE
-- -------
-- - Final, immutable identity + credential model
-- - Single source of truth for ALL credentials
-- - SA / GA / ACL users supported
-- - Local = Production (NO branching logic)
--
-- STATUS  : FINAL — DO NOT MODIFY
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Extensions (safe + idempotent)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- SCHEMA: secure
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS secure;

-- ===========================================================================
-- TABLE: secure.auth_users  (IDENTITY ONLY)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS secure.auth_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL UNIQUE
);

ALTER TABLE secure.auth_users
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,

  -- Lifecycle
  ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'FIRST_LOGIN_REQUIRED',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Admin universe flags
  ADD COLUMN IF NOT EXISTS is_sa BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_ga BOOLEAN NOT NULL DEFAULT FALSE,

  -- Role metadata (authoritative)
  ADD COLUMN IF NOT EXISTS role_code TEXT NOT NULL DEFAULT 'L1_USER',
  ADD COLUMN IF NOT EXISTS role_rank INTEGER NOT NULL DEFAULT 10,

  -- Org context (NULL for SA / GA)
  ADD COLUMN IF NOT EXISTS hr_company_id UUID,
  ADD COLUMN IF NOT EXISTS department_code TEXT,

  -- Audit
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ---------------------------------------------------------------------------
-- ADMIN vs ACL UNIVERSE CONSTRAINT
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_auth_users_admin_universe'
  ) THEN
    ALTER TABLE secure.auth_users
      ADD CONSTRAINT chk_auth_users_admin_universe
      CHECK (
        -- SA
        (is_sa = TRUE  AND is_ga = FALSE AND role_code = 'SA' AND role_rank = 999)
        OR
        -- GA
        (is_ga = TRUE  AND is_sa = FALSE AND role_code = 'GA' AND role_rank = 888)
        OR
        -- ACL users
        (is_sa = FALSE AND is_ga = FALSE AND role_rank < 888)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RLS: auth_users
-- ---------------------------------------------------------------------------
ALTER TABLE secure.auth_users ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE secure.auth_users FROM anon;
REVOKE ALL ON TABLE secure.auth_users FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE secure.auth_users
  TO service_role;

-- ===========================================================================
-- TABLE: secure.auth_credentials  (CREDENTIALS ONLY)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS secure.auth_credentials (
  user_id UUID PRIMARY KEY
    REFERENCES secure.auth_users(id)
    ON DELETE CASCADE,

  password_hash TEXT NOT NULL,
  passcode_hash TEXT NOT NULL,

  force_first_login BOOLEAN NOT NULL DEFAULT TRUE,

  password_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  passcode_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- RLS: auth_credentials (STRICT)
-- ---------------------------------------------------------------------------
ALTER TABLE secure.auth_credentials ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE secure.auth_credentials FROM anon;
REVOKE ALL ON TABLE secure.auth_credentials FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE secure.auth_credentials
  TO service_role;

COMMENT ON TABLE secure.auth_credentials IS
'CANONICAL credential store. Password + passcode hashes ONLY. 
Used by login, first-login, reset, trusted devices.';

COMMIT;
