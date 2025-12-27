/*
 * File-ID: ID-2.3A
 * File-Path: supabase/functions/api/domains/auth/me/me.handler.ts
 * Gate: 2
 * Phase: 2
 * Domain: AUTH
 * Purpose: WhoAmI (/api/me) identity probe
 * Authority: Backend (SSOT)
 *
 * Rules:
 *  - Identity only (no roles, no permissions)
 *  - Cookie is HttpOnly; handler does not read it directly
 *  - Session authority = DB (not implemented in Step-1)
 *  - Fail-closed by default
 */

import { apiResponse, Action } from "../../../utils/response.ts";

/*
 * GET /api/me
 * ---------------------------------------------------------------------------
 * Answers: "Am I logged in?"
 * Returns identity ONLY if session is valid
 * ---------------------------------------------------------------------------
 */
export async function meHandler(
  _req: Request,
  ctx: {
    session?: {
      sessionId: string;
      state: "ACTIVE";
    };
  }
): Promise<Response> {

  if (!ctx.session || ctx.session.state !== "ACTIVE") {
    return apiResponse(
      {
        status: "ERROR",
        code: "AUTH_NOT_LOGGED_IN",
        message: "No active session",
        action: Action.LOGOUT,
      },
      401
    );
  }

  return apiResponse(
    {
      status: "OK",
      code: "AUTH_ME_SUCCESS",
      message: "Session active",
      action: Action.NONE,
      data: {
        sessionId: ctx.session.sessionId,
      },
    },
    200
  );
}

