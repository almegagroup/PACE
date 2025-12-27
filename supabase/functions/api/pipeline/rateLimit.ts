/*
 * File-ID: ID-2.5 + 2.5A + 2.5B
 * File-Path: supabase/functions/api/pipeline/rateLimit.ts
 * Gate: 2
 * Phase: 2
 * Domain: SECURITY
 * Purpose: Auth login rate limiting only
 * Authority: Backend (SSOT)
 */

import { logAuthEvent } from "../utils/authAudit.ts";

const WINDOW_MS = 60_000; // 1 minute
const MAX_IP_REQUESTS = 10;
const MAX_ACCOUNT_REQUESTS = 5;

// ---- In-memory stores (best effort, Gate-2 safe) ----
const ipBucket = new Map<string, { count: number; windowStart: number }>();
const accountBucket = new Map<
  string,
  { count: number; windowStart: number }
>();

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getClientIP(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "UNKNOWN"
  );
}

async function extractAccountHint(req: Request): Promise<string | null> {
  try {
    const clone = req.clone();
    const contentType = clone.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      return null;
    }

    const body = await clone.json();

    // Gate-2 rule:
    // - identifier only
    // - no email / userId guessing
    return body?.identifier
      ? String(body.identifier).toLowerCase()
      : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Rate limit entry
// ─────────────────────────────────────────────

export async function applyRateLimit(
  req: Request
): Promise<Response | null> {
  const path = new URL(req.url).pathname;

  // Gate-2 rule:
  // - Rate limit ONLY login
  if (!path.endsWith("/auth/login")) {
    return null;
  }

  const now = Date.now();

  // ───────────── IP BASED (ID-2.5A) ─────────────
  const ip = getClientIP(req);
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
    requestId: req.headers.get("X-Request-Id") ?? undefined,
    result: "BLOCKED",
  });

  return rateLimitResponse();
}
  }

  // ───────────── ACCOUNT BASED (ID-2.5B) ─────────────
  const accountHint = await extractAccountHint(req);

  if (accountHint) {
    const accEntry = accountBucket.get(accountHint);

    if (!accEntry || now - accEntry.windowStart > WINDOW_MS) {
      accountBucket.set(accountHint, {
        count: 1,
        windowStart: now,
      });
    } else {
      accEntry.count += 1;

      if (accEntry.count > MAX_ACCOUNT_REQUESTS) {
  await logAuthEvent({
    eventType: "RATE_LIMITED",
    identifier: accountHint,
    ip,
    requestId: req.headers.get("X-Request-Id") ?? undefined,
    result: "BLOCKED",
  });

  return rateLimitResponse();
}
    }
  }

  return null;
}

// ─────────────────────────────────────────────
// Response helper (SSOT-safe)
// ─────────────────────────────────────────────

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
