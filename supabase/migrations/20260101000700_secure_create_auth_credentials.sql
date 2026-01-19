-- ============================================================================
-- PACE-ERP :: AUTH DOMAIN
-- File-ID : ID-4.2A-FN
-- Gate    : 4
-- Phase   : 4
-- Domain  : SECURITY
-- Purpose :
--   - Canonical DB-side credential creation
--   - pgcrypto hashing ONLY
--   - Called ONLY by service_role
-- Status  : FINAL
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- FUNCTION: secure.create_auth_credentials
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION secure.create_auth_credentials(
  p_user_id uuid,
  p_password text,
  p_passcode text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO secure.auth_credentials (
    user_id,
    password_hash,
    passcode_hash,
    force_first_login
  )
  VALUES (
    p_user_id,
    crypt(p_password, gen_salt('bf')),
    crypt(p_passcode, gen_salt('bf')),
    TRUE
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- PERMISSIONS
-- ---------------------------------------------------------------------------
GRANT EXECUTE
ON FUNCTION secure.create_auth_credentials(uuid, text, text)
TO service_role;

COMMIT;
