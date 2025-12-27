/*
 * File-ID: ID-9A + ID-2.2A
 * File-Path: supabase/functions/api/utils/response.ts
 * Gate: 1 + Gate 2
 * Phase: 1
 * Domain: SECURITY / AUTH-TRANSPORT
 * Purpose:
 *  - Action-driven API response envelope
 *  - Centralized HttpOnly session cookie handling (Gate-2.2)
 * Authority: Backend (SSOT)
 *
 * SSOT NOTE:
 *  - Cookie builders MUST live only in utils/cookie.ts (single authority)
 */

import {
  buildFreshSessionCookie,
  buildExpiredSessionCookie,
} from "./cookies.ts";

export type ActionType = "NONE" | "LOGOUT" | "REDIRECT" | "RELOAD";

export type Envelope = {
  status: "OK" | "ERROR";
  code: string;
  message: string;
  action: ActionType;
  data?: unknown;
  timestamp: string;
};

/*
 ─────────────────────────────────────────────
  apiResponse (SINGLE response authority)
 ─────────────────────────────────────────────
*/
export function apiResponse(
  payload: Omit<Envelope, "timestamp">,
  httpStatus = 200,
  ctx?: {
    route?: string;
    session?: {
      id: string;
      ttl: number;
    };
    env?: {
      COOKIE_DOMAIN: string;
      PROD: boolean;
    };
  }
): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };

  /*
   * ─────────────────────────────────────────
   * ID-2.2 :: SESSION COOKIE ISSUE (LOGIN ONLY)
   * ─────────────────────────────────────────
   */
  if (
    ctx?.route === "/auth/login" &&
    payload.status === "OK" &&
    ctx?.session?.id &&
    ctx?.env?.COOKIE_DOMAIN
  ) {
    headers["Set-Cookie"] = buildFreshSessionCookie({
      sessionId: ctx.session.id,
      maxAge: ctx.session.ttl,
      domain: ctx.env.COOKIE_DOMAIN,
      secure: ctx.env.PROD === true,
    });
  }

  /*
   * Logout / forced logout cookie revoke
   */
  if (payload.action === "LOGOUT" && ctx?.env?.COOKIE_DOMAIN) {
    headers["Set-Cookie"] = buildExpiredSessionCookie(
      ctx.env.COOKIE_DOMAIN
    );
  }

  return new Response(
    JSON.stringify({
      ...payload,
      timestamp: new Date().toISOString(),
    }),
    {
      status: httpStatus,
      headers,
    }
  );
}

/*
 ─────────────────────────────────────────────
  Action helpers (unchanged)
 ─────────────────────────────────────────────
*/
export const Action = {
  NONE: "NONE" as ActionType,
  LOGOUT: "LOGOUT" as ActionType,
  REDIRECT: "REDIRECT" as ActionType,
  RELOAD: "RELOAD" as ActionType,
};
