-- ============================================================================
-- PACE-ERP :: AUTH DOMAIN
-- File    : A20260104_01_DROP_LEGACY_auth_users_state_check.sql
-- Gate    : 4
-- Phase   : 4
-- Domain  : AUTH / SECURITY
--
-- PURPOSE
-- -------
-- Remove legacy CHECK constraint that blocks canonical
-- FIRST_LOGIN_REQUIRED lifecycle introduced in Gate-4.
--
-- WHY
-- ---
-- Older migrations enforced:
--   state IN ('ACTIVE','DISABLED','LOCKED')
-- which conflicts with canonical Gate-4 lifecycle.
--
-- SSOT
-- ----
-- No new logic introduced.
-- No schema redesign.
-- Pure legacy cleanup.
--
-- SAFE
-- ----
-- Idempotent
-- Production-safe
-- Replay-safe
-- ============================================================================

BEGIN;

ALTER TABLE secure.auth_users
DROP CONSTRAINT IF EXISTS auth_users_state_check;

COMMIT;
