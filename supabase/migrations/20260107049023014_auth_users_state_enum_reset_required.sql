-- ============================================================================
-- PACE-ERP :: AUTH
-- Gate   : 4
-- Patch  : AUTH_USERS_STATE_ENUM_RESET_REQUIRED
-- Purpose: Convert secure.auth_users.state from TEXT -> ENUM and add RESET_REQUIRED
-- Status : FINAL, SAFE
-- ============================================================================

BEGIN;

-- 1) Create enum type if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'auth_user_state'
      AND n.nspname = 'secure'
  ) THEN
    CREATE TYPE secure.auth_user_state AS ENUM (
      'ACTIVE',
      'DISABLED',
      'LOCKED',
      'FIRST_LOGIN_REQUIRED',
      'RESET_REQUIRED'
    );
  END IF;
END $$;

-- 2) Guard: ensure no unsupported values exist
DO $$
DECLARE
  v_bad_count int;
BEGIN
  SELECT count(*)
  INTO v_bad_count
  FROM secure.auth_users
  WHERE state IS NULL
     OR state NOT IN (
       'ACTIVE',
       'DISABLED',
       'LOCKED',
       'FIRST_LOGIN_REQUIRED',
       'RESET_REQUIRED'
     );

  IF v_bad_count > 0 THEN
    RAISE EXCEPTION
      'AUTH_USERS_STATE_HAS_UNSUPPORTED_VALUES: % rows',
      v_bad_count;
  END IF;
END $$;

-- 3) IMPORTANT: drop default BEFORE type cast
ALTER TABLE secure.auth_users
  ALTER COLUMN state DROP DEFAULT;

-- 4) Alter column type TEXT -> ENUM
ALTER TABLE secure.auth_users
  ALTER COLUMN state
  TYPE secure.auth_user_state
  USING state::secure.auth_user_state;

-- 5) Restore default
ALTER TABLE secure.auth_users
  ALTER COLUMN state SET DEFAULT 'ACTIVE';

COMMIT;
