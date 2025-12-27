// ============================================================================
// PACE-ERP :: AUTH DOMAIN
// Gate  : 2 (AUTH)
// ID    : 2.1 (Login API)
// File  : login.types.ts
// Role  : Shared contracts & internal constants for Login flow
// Status: ACTIVE (Gate-2 In Progress)
// ----------------------------------------------------------------------------
// SSOT RULE:
// - This file contains NO logic
// - This file defines ONLY contracts & enums
// - Any change here impacts ALL login steps (2.1A / 2.1B / 2.1C)
// ============================================================================


/* ============================================================================
 * LOGIN REQUEST CONTRACT
 * ---------------------------------------------------------------------------
 * This represents the exact payload expected by POST /auth/login
 * No additional fields are allowed.
 * ============================================================================
 */

/**
 * @typedef {Object} LoginRequest
 * @property {string} identifier  User provided ID (example: "P0001")
 * @property {string} password    Plain password (never logged, never stored)
 */


/* ============================================================================
 * PUBLIC RESPONSE CODES (CLIENT VISIBLE)
 * ---------------------------------------------------------------------------
 * These codes are part of the external API contract.
 * DO NOT add, remove, or rename without SSOT approval.
 * ============================================================================
 */

export const LOGIN_PUBLIC_CODE = {
  SUCCESS: 'AUTH_LOGIN_SUCCESS',
  FAILED: 'AUTH_LOGIN_FAILED',
};


/* ============================================================================
 * INTERNAL FAILURE REASONS (SERVER ONLY)
 * ---------------------------------------------------------------------------
 * These are NEVER exposed to frontend.
 * Used strictly for:
 * - structured logs
 * - audit trails
 * - debugging
 * ============================================================================
 */

export const LOGIN_INTERNAL_FAILURE = {
  BAD_INPUT: 'BAD_INPUT',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  PASSWORD_MISMATCH: 'PASSWORD_MISMATCH',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  SESSION_CREATE_FAILED: 'SESSION_CREATE_FAILED',
};


/* ============================================================================
 * ACCOUNT STATE (AUTH DOMAIN ONLY)
 * ---------------------------------------------------------------------------
 * These states control login eligibility.
 * Authorization / roles are NOT part of this domain.
 * ============================================================================
 */

export const ACCOUNT_STATE = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
  LOCKED: 'LOCKED',
};


/* ============================================================================
 * STANDARD INTERNAL RESULT SHAPE
 * ---------------------------------------------------------------------------
 * All internal login steps (2.1A / 2.1B / 2.1C) MUST return this structure.
 * ============================================================================
 */

/**
 * @typedef {Object} InternalResult
 * @property {boolean} ok
 * @property {any}     [data]
 * @property {string}  [reason] One of LOGIN_INTERNAL_FAILURE
 */
