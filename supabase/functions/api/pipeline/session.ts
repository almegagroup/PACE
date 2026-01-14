/*
 * File-ID: ID-6A+6B (FINAL)
 * File-Path: supabase/functions/api/pipeline/session.ts
 * Gate: 1
 * Phase: 1
 * Domain: SESSION
 * Purpose: Session resolver + Gate-3 lifecycle enforcement + Gate-3.2 Absolute TTL
 * Authority: Backend
 */

import {
  getSessionById,
  markSessionIdle,
  markSessionExpired,
  touchSessionActivity,
} from "../domains/auth/login/_internals/auth.db.ts";

import { logSessionTransition } from "../domains/auth/login/_internals/session.timeline.ts";

/* ===============================
   ENV DETECTION (SSOT)
   =============================== */
const IS_PROD =
  Deno.env.get("ENV") === "production" ||
  Deno.env.get("SUPABASE_ENV") === "production";

/* ===============================
   Gate-3 Idle Timing Controls
   =============================== */
const IDLE_THRESHOLD_MS = 20 * 60 * 1000;        // 20 min → ACTIVE → IDLE
const IDLE_WARNING_WINDOW_MS = 2 * 60 * 1000;    // last 2 min warning
const IDLE_HARD_LIMIT_MS = 30 * 60 * 1000;       // 30 min → IDLE → EXPIRED

/* ===============================
   Gate-3.2 Absolute TTL Controls
   =============================== */
const ABSOLUTE_TTL_MS = 8 * 60 * 60 * 1000;           // 8 hours hard stop
const ABSOLUTE_WARN_SOFT_MS = 6 * 60 * 60 * 1000;    // 6 hours warning
const ABSOLUTE_WARN_FINAL_MS = 7.5 * 60 * 60 * 1000; // 7.5 hours final warning

export type SessionState =
  | "ACTIVE"
  | "IDLE"
  | "REVOKED"
  | "EXPIRED"
  | "NONE";

export type SessionResult = {
  status: "ANONYMOUS" | "CLAIMED";
  sessionId?: string;
  state: SessionState;
  idleWarning?: true;
  ttlWarning?: "SOFT" | "FINAL";
  response?: Response | null;
};

/* ===============================
   Logout Response Helper
   =============================== */
function sessionLogoutResponse(code: string, message: string): Response {
  return new Response(
    JSON.stringify({
      status: "ERROR",
      code,
      message,
      action: "LOGOUT",
      timestamp: new Date().toISOString(),
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    }
  );
}

/* ===============================
   Session Resolver (Gate-1)
   =============================== */
export async function resolveSession(req: Request): Promise<SessionResult> {

  /* =========================================================
     DEV / LOCAL SESSION (HEADER FALLBACK)
     ========================================================= */
  if (!IS_PROD) {
    const devSessionId =
      req.headers.get("x-dev-session") ||
      req.headers.get("x-session-id");

    if (devSessionId) {
      const session = await getSessionById(devSessionId);

      if (session) {
        return {
          status: "CLAIMED",
          sessionId: devSessionId,
          state: session.state,
          response: null,
        };
      }
    }
  }

  /* =========================================================
     PROD / COOKIE BASED SESSION (AUTHORITATIVE)
     ========================================================= */
  const cookieHeader = req.headers.get("cookie");

  if (!cookieHeader) {
    return { status: "ANONYMOUS", state: "NONE", response: null };
  }

  const sessionCookie = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("pace_session="));

  if (!sessionCookie) {
    return { status: "ANONYMOUS", state: "NONE", response: null };
  }

  const sessionId = sessionCookie.replace("pace_session=", "");
  const session = await getSessionById(sessionId);

  if (!session) {
    return { status: "ANONYMOUS", state: "NONE", response: null };
  }

  /* =========================================================
     EXISTING LIFECYCLE LOGIC (UNCHANGED)
     ========================================================= */
  const now = Date.now();
  const lastActivity = new Date(session.last_activity_at).getTime();
  const createdAt = new Date(session.created_at).getTime();

  const inactiveFor = now - lastActivity;
  const sessionAge = now - createdAt;

  let effectiveState: SessionState = session.state;
  let idleWarning = false;
  let ttlWarning: "SOFT" | "FINAL" | undefined;

  /* ===============================
     Gate-3.2 Absolute TTL (TOP PRIORITY)
     =============================== */
  if (sessionAge >= ABSOLUTE_TTL_MS) {
    await markSessionExpired(session.id);

    await logSessionTransition({
      sessionId,
      fromState: "ACTIVE",
      toState: "EXPIRED",
      event: "ABSOLUTE_TTL",
      requestId: req.headers.get("X-Request-Id") ?? undefined,
      source: "session.resolver",
    });

    return {
      status: "CLAIMED",
      sessionId,
      state: "EXPIRED",
      response: sessionLogoutResponse(
        "SESSION_ABSOLUTE_TIMEOUT",
        "Session expired due to maximum lifetime."
      ),
    };
  }

  if (sessionAge >= ABSOLUTE_WARN_FINAL_MS) {
    ttlWarning = "FINAL";
  } else if (sessionAge >= ABSOLUTE_WARN_SOFT_MS) {
    ttlWarning = "SOFT";
  }

  /* ===============================
     ACTIVE → IDLE
     =============================== */
  if (session.state === "ACTIVE") {
    if (
      inactiveFor >= IDLE_THRESHOLD_MS - IDLE_WARNING_WINDOW_MS &&
      inactiveFor < IDLE_THRESHOLD_MS
    ) {
      idleWarning = true;
    }

    if (inactiveFor >= IDLE_THRESHOLD_MS) {
      await markSessionIdle(session.id);
      effectiveState = "IDLE";

      await logSessionTransition({
        sessionId,
        fromState: "ACTIVE",
        toState: "IDLE",
        event: "IDLE_THRESHOLD",
        requestId: req.headers.get("X-Request-Id") ?? undefined,
        source: "session.resolver",
      });
    }
  }

  /* ===============================
     IDLE → EXPIRED
     =============================== */
  if (effectiveState === "IDLE" && inactiveFor >= IDLE_HARD_LIMIT_MS) {
    await markSessionExpired(session.id);

    await logSessionTransition({
      sessionId,
      fromState: "IDLE",
      toState: "EXPIRED",
      event: "IDLE_TIMEOUT",
      requestId: req.headers.get("X-Request-Id") ?? undefined,
      source: "session.resolver",
    });

    return {
      status: "CLAIMED",
      sessionId,
      state: "EXPIRED",
      response: sessionLogoutResponse(
        "SESSION_IDLE_TIMEOUT",
        "Session expired due to inactivity."
      ),
    };
  }

  /* ===============================
     Admin Force Revoke
     =============================== */
  if (
    effectiveState === "REVOKED" &&
    session.revoked_reason === "ADMIN_FORCE"
  ) {
    return {
      status: "CLAIMED",
      sessionId,
      state: "REVOKED",
      response: sessionLogoutResponse(
        "SESSION_FORCE_LOGOUT",
        "You have been logged out by administrator."
      ),
    };
  }

  if (effectiveState === "REVOKED") {
    return {
      status: "CLAIMED",
      sessionId,
      state: "REVOKED",
      response: sessionLogoutResponse(
        "SESSION_REVOKED",
        "Session has been revoked."
      ),
    };
  }

  if (effectiveState === "EXPIRED") {
    return {
      status: "CLAIMED",
      sessionId,
      state: "EXPIRED",
      response: sessionLogoutResponse(
        "SESSION_EXPIRED",
        "Session has expired."
      ),
    };
  }

  /* ===============================
     ACTIVE / IDLE PASS THROUGH
     =============================== */
  await touchSessionActivity(session.id);

  return {
    status: "CLAIMED",
    sessionId,
    state: effectiveState,
    idleWarning: idleWarning || undefined,
    ttlWarning,
    response: null,
  };
}
