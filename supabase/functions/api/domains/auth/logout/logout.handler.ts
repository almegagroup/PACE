/*
 * File-ID: ID-2.4
 * File-Path: supabase/functions/api/domains/auth/logout/logout.handler.ts
 * Gate: 2
 * Phase: 2
 * Domain: AUTH
 * Purpose: Logout intent only (SSOT-compliant)
 * Authority: Backend
 */

import { Action } from "../../../utils/response.ts";
import { logAuthEvent } from "../../../utils/authAudit.ts";

export async function logoutHandler(
  _req: Request,
  ctx: {
    session?: {
      sessionId: string;
      state: "ACTIVE" | "REVOKED" | "EXPIRED";
    };
  }
) {
  // ─────────────────────────────────────────
  // ID-2.7 :: Minimal audit (non-intrusive)
  // Gate-2 rule:
  // - Logout is intent
  // - Identifier optional
  // ─────────────────────────────────────────
  await logAuthEvent({
    eventType: "LOGOUT",
    result: "OK",
  });

  // ─────────────────────────────────────────
  // ID-2.4 :: Logout intent response
  // ─────────────────────────────────────────
  return {
    status: "OK",
    code: "AUTH_LOGOUT_SUCCESS",
    message: "Logged out",
    action: Action.LOGOUT,
  };
}
