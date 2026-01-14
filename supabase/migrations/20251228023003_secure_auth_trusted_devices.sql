-- ============================================================================
-- PACE-ERP :: AUTH DOMAIN
-- File-ID : ID-4.SEC.TRUSTED_DEVICE
-- File    : A20251228_03_secure_auth_trusted_devices.sql
-- Gate    : 4
-- Phase   : 4
-- Domain  : SECURITY
-- Purpose : Trusted device registry per user
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
-- TABLE: secure.auth_trusted_devices
-- ----------------------------------------------------------------------------
-- One row = one trusted device for one user
-- Max 3 devices enforced at API layer
-- ============================================================================

CREATE TABLE IF NOT EXISTS secure.auth_trusted_devices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid NOT NULL
        REFERENCES secure.auth_users(id)
        ON DELETE CASCADE,

    device_tag text NOT NULL,
    device_name text,

    trusted_at timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE secure.auth_trusted_devices OWNER TO postgres;

-- ============================================================================
-- INDEXES
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user
    ON secure.auth_trusted_devices(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_device_tag
    ON secure.auth_trusted_devices(user_id, device_tag);

-- ============================================================================
-- RLS (STRICT)
-- ----------------------------------------------------------------------------
-- Only service_role can touch trusted devices
-- ============================================================================

ALTER TABLE secure.auth_trusted_devices ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE secure.auth_trusted_devices FROM anon;
REVOKE ALL ON TABLE secure.auth_trusted_devices FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE secure.auth_trusted_devices
TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE secure.auth_trusted_devices IS
'Gate-4 Security: Trusted devices per user. 
Used for passcode-based device trust. 
WIPED on passcode reset.';

COMMENT ON COLUMN secure.auth_trusted_devices.device_tag IS
'Non-PII deterministic device fingerprint (hashed).';

COMMENT ON COLUMN secure.auth_trusted_devices.device_name IS
'User-defined label like Laptop-Office, Mobile-Personal.';
