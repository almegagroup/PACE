-- ============================================================================
-- PACE-ERP :: AUTH DOMAIN
-- File    : 20260106002000_FINAL_AUTH_SIGNUP_REQUESTS_CANONICAL.sql
-- Gate    : 4
-- Phase   : 4
-- Domain  : AUTH / GOVERNANCE
--
-- PURPOSE
-- -------
-- - Single authoritative schema for public.auth_signup_requests
-- - Full lifecycle support:
--     REQUESTED
--       -> APPROVED_SETUP_PENDING
--       -> SET_FIRST_LOGIN
--       -> CONSUMED
-- - Preserve rejection flow
-- - Preserve approval / rejection / consumption metadata
-- - Eliminate all conflicting CHECK constraints
--
-- SAFE
-- ----
-- - Schema-only
-- - Deterministic
-- - Replay-safe
-- - Local + Production safe
--
-- SSOT
-- ----
-- public.auth_signup_requests
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1️⃣ ENSURE METADATA COLUMNS EXIST
-- ---------------------------------------------------------------------------
ALTER TABLE public.auth_signup_requests
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS consumed_by TEXT,
  ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 2️⃣ DROP ALL EXISTING CHECK CONSTRAINTS ON THIS TABLE
--    (prevents silent override / conflict forever)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.auth_signup_requests'::regclass
      AND contype = 'c'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.auth_signup_requests DROP CONSTRAINT %I',
      r.conname
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3️⃣ CREATE SINGLE CANONICAL STATE CONSTRAINT
-- ---------------------------------------------------------------------------
ALTER TABLE public.auth_signup_requests
ADD CONSTRAINT auth_signup_requests_state_check
CHECK (
  state IN (
    'REQUESTED',
    'APPROVED_SETUP_PENDING',
    'SET_FIRST_LOGIN',
    'REJECTED',
    'CONSUMED'
  )
);

COMMIT;
