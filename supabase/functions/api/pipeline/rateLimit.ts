/*
 * File-ID: ID-5B
 * File-Path: supabase/functions/api/pipeline/rateLimit.ts
 * Gate: 1
 * Phase: 1
 * Domain: SECURITY
 * Purpose: Account-based throttle (heuristic, Gate-1 safe)
 * Authority: Backend
 */

const WINDOW_MS = 60_000; // 1 minute
const MAX_IP_REQUESTS = 10;
const MAX_ACCOUNT_REQUESTS = 5;

// ---- In-memory stores (best effort) ----
const ipBucket = new Map<string, { count: number; windowStart: number }>();
const accountBucket = new Map<
  string,
  { count: number; windowStart: number }
>();

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

    // Heuristic identifiers only
    return (
      body?.email ||
      body?.username ||
      body?.userId ||
      null
    );
  } catch {
    return null;
  }
}

export async function applyRateLimit(
  req: Request
): Promise<Response | null> {
  const method = req.method.toUpperCase();
  const isStateChanging =
    method === "POST" ||
    method === "PUT" ||
    method === "PATCH" ||
    method === "DELETE";

  if (!isStateChanging) {
    return null;
  }

  const now = Date.now();

  // ---------- IP BASED (ID-5A) ----------
  const ip = getClientIP(req);
  const ipEntry = ipBucket.get(ip);

  if (!ipEntry || now - ipEntry.windowStart > WINDOW_MS) {
    ipBucket.set(ip, { count: 1, windowStart: now });
  } else {
    ipEntry.count += 1;
    if (ipEntry.count > MAX_IP_REQUESTS) {
      return rateLimitResponse("RATE_LIMIT_IP");
    }
  }

  // ---------- ACCOUNT BASED (ID-5B) ----------
  const accountHint = await extractAccountHint(req);

  if (accountHint) {
    const key = String(accountHint).toLowerCase();
    const accEntry = accountBucket.get(key);

    if (!accEntry || now - accEntry.windowStart > WINDOW_MS) {
      accountBucket.set(key, { count: 1, windowStart: now });
    } else {
      accEntry.count += 1;
      if (accEntry.count > MAX_ACCOUNT_REQUESTS) {
        return rateLimitResponse("RATE_LIMIT_ACCOUNT");
      }
    }
  }

  return null;
}

function rateLimitResponse(code: string): Response {
  return new Response(
    JSON.stringify({
      status: "ERROR",
      code,
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
