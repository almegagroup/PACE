-- ============================================================================
-- PACE-ERP :: AUTH DOMAIN
-- File    : A20260104_02_ADD_ACL_ASSIGNED_TO_AUTH_USERS.sql
-- Gate    : 4
-- Phase   : 4
-- Domain  : AUTH / SECURITY
--
-- PURPOSE
-- -------
-- Introduce explicit ACL readiness gate.
-- Password setup (FIRST LOGIN) does NOT activate user.
-- User becomes ACTIVE only after SA assigns ACL.
--
-- OPTION-B SSOT
-- --------------
-- password_set        => READY
-- acl_assigned        => ACTIVE
-- SA / GA             => bypass (set at creation)
--
-- SAFE
-- ----
-- Additive only
-- Fresh DB safe
-- Replay safe
-- ============================================================================

BEGIN;

ALTER TABLE secure.auth_users
  ADD COLUMN IF NOT EXISTS acl_assigned BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN secure.auth_users.acl_assigned IS
'Access readiness flag.
TRUE only after SA assigns ACL (role/project).
Password setup alone does NOT activate user.';

COMMIT;
