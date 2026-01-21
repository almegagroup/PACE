-- ============================================================================
-- PACE-ERP :: AUTH DOMAIN
-- Gate  : 4 (Credential Authority)
-- ID    : AUTH_VERIFY_PASSWORD_RPC
-- Purpose : DB-native password verification using pgcrypto (Supabase-safe)
-- Status  : FINAL
-- ============================================================================

BEGIN;

-- Ensure pgcrypto exists (Supabase installs it in extensions schema)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Canonical password verification function
CREATE OR REPLACE FUNCTION secure.verify_user_password(
  p_user_id uuid,
  p_password text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = secure, extensions, public
AS $$
  SELECT
    extensions.crypt(p_password, c.password_hash) = c.password_hash
  FROM secure.auth_credentials c
  WHERE c.user_id = p_user_id;
$$;

COMMIT;
