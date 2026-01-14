-- ============================================================================
-- PACE-ERP :: AUTH DOMAIN
-- File-ID : ID-4.2A
-- File    : A20251228_02_secure_auth_credentials.sql
-- Gate    : 4
-- Phase   : 4
-- Domain  : SECURITY
-- Purpose : Secure storage for password & passcode (hashed only)
-- Status  : FINAL – FROZEN
-- ============================================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET row_security = off;

-- ============================================================================
-- TABLE: secure.auth_credentials
-- ----------------------------------------------------------------------------
-- One row per user
-- Password & passcode stored ONLY as hashes
-- Used by:
--  - First login
--  - Normal login
--  - Password reset
--  - Passcode reset
--  - Trusted device workflows
-- ============================================================================

CREATE TABLE IF NOT EXISTS secure.auth_credentials (
    user_id uuid PRIMARY KEY
        REFERENCES secure.auth_users(id)
        ON DELETE CASCADE,

    password_hash text NOT NULL,
    passcode_hash text NOT NULL,

    force_first_login boolean NOT NULL DEFAULT true,

    password_updated_at timestamptz NOT NULL DEFAULT now(),
    passcode_updated_at timestamptz NOT NULL DEFAULT now(),

    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE secure.auth_credentials OWNER TO postgres;

-- ============================================================================
-- SECURITY: RLS
-- ----------------------------------------------------------------------------
-- Absolute rule:
-- - ONLY service_role can access this table
-- - NEVER exposed to anon / authenticated
-- ============================================================================

ALTER TABLE secure.auth_credentials ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE secure.auth_credentials FROM anon;
REVOKE ALL ON TABLE secure.auth_credentials FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE secure.auth_credentials
TO service_role;

-- ============================================================================
-- COMMENTS (SSOT documentation)
-- ============================================================================

COMMENT ON TABLE secure.auth_credentials IS
'Gate-4.2A: Secure credential storage (password + passcode hashes only). 
Plain text NEVER stored. Common for SA, GA, ACL users.';

COMMENT ON COLUMN secure.auth_credentials.force_first_login IS
'TRUE until first successful password+passcode setup is completed.';

