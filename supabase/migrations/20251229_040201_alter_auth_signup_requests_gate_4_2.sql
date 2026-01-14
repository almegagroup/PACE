-- ============================================================================
-- PACE-ERP :: AUTH DOMAIN
-- File-ID : ID-4.2 / ID-4.2A / ID-4.2B
-- Gate    : 4
-- Phase   : 4
-- Domain  : ADMIN / GOVERNANCE
--
-- PURPOSE
-- -------
-- - Fix public.auth_signup_requests lifecycle completeness
-- - Support APPROVED → CONSUMED flow
-- - Store approval / rejection / consumption metadata
--
-- SCOPE
-- -----
-- ⚠️ ONLY alters public.auth_signup_requests
-- ⚠️ No new tables
-- ⚠️ No data mutation
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1️⃣ Add approval metadata
-- ---------------------------------------------------------------------------
ALTER TABLE public.auth_signup_requests
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 2️⃣ Add rejection metadata
-- ---------------------------------------------------------------------------
ALTER TABLE public.auth_signup_requests
  ADD COLUMN IF NOT EXISTS rejected_by TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ---------------------------------------------------------------------------
-- 3️⃣ Add consumption metadata (Gate-4.2A)
-- ---------------------------------------------------------------------------
ALTER TABLE public.auth_signup_requests
  ADD COLUMN IF NOT EXISTS consumed_by TEXT,
  ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 4️⃣ Fix STATE constraint (REQUESTED → APPROVED → CONSUMED)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'auth_signup_requests_state_check'
  ) THEN
    ALTER TABLE public.auth_signup_requests
      DROP CONSTRAINT auth_signup_requests_state_check;
  END IF;
END $$;

ALTER TABLE public.auth_signup_requests
  ADD CONSTRAINT auth_signup_requests_state_check
  CHECK (
    state IN (
      'REQUESTED',
      'APPROVED_SETUP_PENDING',
      'REJECTED',
      'CONSUMED'
    )
  );

COMMIT;
