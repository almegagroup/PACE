-- ============================================================================
-- PACE-ERP :: AUTH DOMAIN
-- File    : A20260106_01_AUTH_SIGNUP_ADD_SET_FIRST_LOGIN.sql
-- Gate    : 4
-- Phase   : 4
-- Domain  : AUTH / GOVERNANCE
--
-- PURPOSE
-- -------
-- - Introduce SET_FIRST_LOGIN state in signup lifecycle
-- - Fix stale CHECK constraint deterministically
-- - Preserve CONSUMED as final, user-driven terminal state
--
-- SAFE
-- ----
-- - Schema-only
-- - Deterministic
-- - Replay-safe
-- - Local + Production
--
-- SSOT
-- ----
-- public.auth_signup_requests.state
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1️⃣ HARD DROP existing constraint (MANDATORY)
-- ---------------------------------------------------------------------------
ALTER TABLE public.auth_signup_requests
DROP CONSTRAINT IF EXISTS auth_signup_requests_state_check;

-- ---------------------------------------------------------------------------
-- 2️⃣ Recreate constraint with SET_FIRST_LOGIN added
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
