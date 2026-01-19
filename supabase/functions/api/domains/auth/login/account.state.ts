// ============================================================================
// PACE-ERP :: AUTH DOMAIN
// Gate  : 2 (AUTH)
// ID    : 2.1B (Account State Check)
// File  : account.state.ts
// Status: FINAL (Gate-4 Aware)
// ----------------------------------------------------------------------------

import { LOGIN_INTERNAL_FAILURE, ACCOUNT_STATE } from './login.types.ts';

export function checkAccountState(
  user: { account_state?: string; [key: string]: any }
) {
  if (!user || !user.account_state) {
    return {
      ok: false,
      reason: LOGIN_INTERNAL_FAILURE.ACCOUNT_DISABLED,
    };
  }

  const state = user.account_state;

  // ─────────────────────────────────────────
  // HARD BLOCK STATES
  // ─────────────────────────────────────────

  if (state === ACCOUNT_STATE.LOCKED) {
    return {
      ok: false,
      reason: LOGIN_INTERNAL_FAILURE.ACCOUNT_LOCKED,
    };
  }

  

  if (state === ACCOUNT_STATE.DISABLED) {
    return {
      ok: false,
      reason: LOGIN_INTERNAL_FAILURE.ACCOUNT_DISABLED,
    };
  }

  // ─────────────────────────────────────────
  // ALLOWED TO PROCEED (handled later)
  // ─────────────────────────────────────────

  if (state === ACCOUNT_STATE.FIRST_LOGIN_REQUIRED) {
    return { ok: true };
  }

  if (state === ACCOUNT_STATE.ACTIVE) {
    return { ok: true };
  }

  // ─────────────────────────────────────────
  // SAFETY NET (unknown state)
  // ─────────────────────────────────────────
  return {
    ok: false,
    reason: LOGIN_INTERNAL_FAILURE.ACCOUNT_DISABLED,
  };
}
