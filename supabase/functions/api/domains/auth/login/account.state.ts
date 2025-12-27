// ============================================================================
// PACE-ERP :: AUTH DOMAIN
// Gate  : 2 (AUTH)
// ID    : 2.1B (Account State Check)
// File  : account.state.ts
// Role  : Validate whether authenticated user is allowed to login
// Status: ACTIVE (Gate-2 In Progress)
// ----------------------------------------------------------------------------
// SSOT RULE:
// - This file checks ONLY account state eligibility
// - NO password validation
// - NO session creation
// - NO cookies
// - NO response shaping
// ============================================================================

import { LOGIN_INTERNAL_FAILURE, ACCOUNT_STATE } from './login.types.ts';

/* ============================================================================
 * checkAccountState
 * ---------------------------------------------------------------------------
 * Responsibilities:
 * - Decide if verified user account is eligible for login
 * - Enforce ACTIVE-only login policy
 * ============================================================================
 */
export function checkAccountState(
  user: { account_state?: string; [key: string]: any }
) {
  if (!user || !user.account_state) {
    return {
      ok: false,
      reason: LOGIN_INTERNAL_FAILURE.ACCOUNT_DISABLED,
    };
  }

  // -------- Account eligibility --------
  if (user.account_state !== ACCOUNT_STATE.ACTIVE) {
    if (user.account_state === ACCOUNT_STATE.LOCKED) {
      return {
        ok: false,
        reason: LOGIN_INTERNAL_FAILURE.ACCOUNT_LOCKED,
      };
    }

    return {
      ok: false,
      reason: LOGIN_INTERNAL_FAILURE.ACCOUNT_DISABLED,
    };
  }

  // -------- Success --------
  return {
    ok: true,
  };
}
