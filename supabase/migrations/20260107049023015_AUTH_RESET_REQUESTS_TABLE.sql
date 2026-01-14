-- ============================================================================
-- PACE-ERP :: AUTH
-- Gate   : 4.5
-- Patch  : AUTH_RESET_REQUESTS_TABLE
-- Purpose: Admin-governed credential reset request lifecycle
-- Status : FINAL, CANONICAL, ONE-SHOT
--
-- Design Principles:
-- - Reset = governance event, not credential event
-- - No password/passcode mutation here
-- - Enumeration-safe, audit-friendly
-- - Signup lifecycle completely isolated
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) ENUM : reset request state
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'auth_reset_request_state'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.auth_reset_request_state AS ENUM (
      'REQUESTED',
      'APPROVED',
      'REJECTED',
      'EXECUTED'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) TABLE : auth_reset_requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auth_reset_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User identity
  user_id           uuid NOT NULL
                    REFERENCES secure.auth_users(id)
                    ON DELETE CASCADE,

  identifier        text NOT NULL, -- phone or email as provided (audit only)

  -- Lifecycle
  state             public.auth_reset_request_state
                    NOT NULL DEFAULT 'REQUESTED',

  -- Governance
  requested_at      timestamptz NOT NULL DEFAULT now(),

  reviewed_by       text,        -- SA identifier
  reviewed_at       timestamptz,
  review_reason     text,

  executed_at       timestamptz,

  -- Safety
  UNIQUE (user_id, state)
    DEFERRABLE INITIALLY IMMEDIATE
);

-- ---------------------------------------------------------------------------
-- 2.1) ROW LEVEL SECURITY (Admin / Backend governed)
-- ---------------------------------------------------------------------------
ALTER TABLE public.auth_reset_requests
ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- 3) INDEXES (governance + performance)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_auth_reset_requests_user
  ON public.auth_reset_requests (user_id);

CREATE INDEX IF NOT EXISTS idx_auth_reset_requests_state
  ON public.auth_reset_requests (state);

CREATE INDEX IF NOT EXISTS idx_auth_reset_requests_requested_at
  ON public.auth_reset_requests (requested_at DESC);

COMMIT;
