-- ============================================================================
-- PACE-ERP :: AUTH
-- Gate   : 4.5B
-- Patch  : ADMIN_RESET_REVIEW_ENFORCEMENT
-- Purpose: Enforce admin-governed reset lifecycle integrity
-- Status : FINAL / IMMUTABLE
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1️⃣ Enforce admin review metadata for governance states
-- ---------------------------------------------------------------------------

ALTER TABLE public.auth_reset_requests
ADD CONSTRAINT chk_reset_review_fields
CHECK (
  (
    state = 'REQUESTED'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  )
  OR
  (
    state IN ('APPROVED', 'REJECTED')
    AND reviewed_by IS NOT NULL
    AND reviewed_at IS NOT NULL
  )
  OR
  (
    state = 'EXECUTED'
    AND reviewed_by IS NOT NULL
    AND reviewed_at IS NOT NULL
    AND executed_at IS NOT NULL
  )
);

-- ---------------------------------------------------------------------------
-- 2️⃣ Prevent re-review after decision
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION prevent_reset_rereview()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.state IN ('APPROVED', 'REJECTED', 'EXECUTED')
     AND NEW.state <> OLD.state THEN
    RAISE EXCEPTION 'Reset request already finalized';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_no_reset_rereview
ON public.auth_reset_requests;

CREATE TRIGGER trg_no_reset_rereview
BEFORE UPDATE ON public.auth_reset_requests
FOR EACH ROW
EXECUTE FUNCTION prevent_reset_rereview();

COMMIT;
