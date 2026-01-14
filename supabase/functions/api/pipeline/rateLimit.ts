/*
 * File-ID: ID-2.5 (SSOT FINAL)
 * File-Path: supabase/functions/api/pipeline/rateLimit.ts
 * Gate: 2 → 4 Compatible
 * Phase: SECURITY
 * Domain: SECURITY
 * Purpose: Login + Signup abuse protection ONLY
 *
 * SSOT RULES:
 * - Applies ONLY to public auth edge routes
 *   • /auth/login
 *   • /auth/signup-request
 * - NEVER touches admin / governance routes
 * - MUST NOT consume request body in Gate-4 pipeline
 * - MUST NOT interfere with approval / admin flows
 */

import { logAuthEvent } from "../utils/authAudit.ts";

// ─────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────
const WINDOW_MS = 60_000;          // 1 minute
const MAX_IP_REQUESTS = 10;
const MAX_ACCOUNT_REQUESTS = 5;

// ─────────────────────────────────────────
// In-memory buckets (Edge-safe, best-effort)
// ─────────────────────────────────────────
const ipBucket = new Map<string, { count: number; windowStart: number }>();
const accountBucket = new Map<string, { count: number; windowStart: number }>();

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function getClientIP(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "UNKNOWN"
  );
}

/*
 * ⚠️ CRITICAL GATE-4 RULE
 * ---------------------
 * ❌ DO NOT read req.body / req.json / req.clone() here
 * Body is reserved for final handlers.
 *
 * Account hint must come ONLY from headers (safe).
 *
 * Frontend MUST send:
 *   X-Auth-Identifier: identifier
 */
function extractAccountHint(req: Request): string | null {
  const hint = req.headers.get("x-auth-identifier");
  return hint ? hint.toLowerCase() : null;
}

// ─────────────────────────────────────────
// Rate Limit Middleware
// ─────────────────────────────────────────
export async function applyRateLimit(
  req: Request
): Promise<Response | null> {
  const path = new URL(req.url).pathname;

  // 🎯 STRICT SCOPE (SSOT)
  const isLogin = path.endsWith("/auth/login");
  const isSignup = path.endsWith("/auth/signup-request");

  // 🚫 Gate-4 safety: never affect admin / approval routes
  if (!isLogin && !isSignup) {
    return null;
  }

  const now = Date.now();
  const ip = getClientIP(req);

  // ─────────────────────────────────────────
  // IP-BASED LIMIT (ID-2.5A)
  // ─────────────────────────────────────────
  const ipEntry = ipBucket.get(ip);

  if (!ipEntry || now - ipEntry.windowStart > WINDOW_MS) {
    ipBucket.set(ip, { count: 1, windowStart: now });
  } else {
    ipEntry.count += 1;

    if (ipEntry.count > MAX_IP_REQUESTS) {
      await logAuthEvent({
        eventType: "RATE_LIMITED",
        identifier: null,
        ip,
        result: "BLOCKED",
      });
      return rateLimitResponse();
    }
  }

  // ─────────────────────────────────────────
  // ACCOUNT-BASED LIMIT (ID-2.5B — RETAINED)
  // ─────────────────────────────────────────
  const accountHint = extractAccountHint(req);

  if (accountHint) {
    const accEntry = accountBucket.get(accountHint);

    if (!accEntry || now - accEntry.windowStart > WINDOW_MS) {
      accountBucket.set(accountHint, { count: 1, windowStart: now });
    } else {
      accEntry.count += 1;

      if (accEntry.count > MAX_ACCOUNT_REQUESTS) {
        await logAuthEvent({
          eventType: "RATE_LIMITED",
          identifier: accountHint,
          ip,
          result: "BLOCKED",
        });
        return rateLimitResponse();
      }
    }
  }

  return null;
}

// ─────────────────────────────────────────
// Response helper (SSOT-safe)
// ─────────────────────────────────────────
function rateLimitResponse(): Response {
  return new Response(
    JSON.stringify({
      status: "ERROR",
      code: "AUTH_RATE_LIMITED",
      message: "Too many requests. Please retry later.",
      action: "NONE",
      timestamp: new Date().toISOString(),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    }
  );
}
