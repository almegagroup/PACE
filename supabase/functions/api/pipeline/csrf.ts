/*
 * File-ID: ID-4
 * File-Path: supabase/functions/api/pipeline/csrf.ts
 * Gate: 1
 * Phase: 1
 * Domain: SECURITY
 * Purpose: CSRF protection using Origin/Referer validation for state-changing requests
 * Authority: Backend
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const ALLOWED_ORIGINS = new Set<string>([
  "https://erp.almegagroup.in",
  "http://localhost:5173",
]);

function extractOriginFromReferer(referer: string | null): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export async function applyCSRF(req: Request): Promise<Response | null> {
  // 4A — Safe method bypass
  if (SAFE_METHODS.has(req.method)) {
    return null;
  }

  const origin = req.headers.get("Origin");
  const referer = req.headers.get("Referer");

  // Prefer Origin, fallback to Referer
  const effectiveOrigin =
    origin ?? extractOriginFromReferer(referer);

  // 4B — Hard block if neither present
  if (!effectiveOrigin) {
    return new Response(
      JSON.stringify({
        status: "ERROR",
        code: "CSRF_MISSING_ORIGIN",
        message: "Missing Origin/Referer for state-changing request.",
        action: "NONE",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  }

  // Validate against allowlist
  if (!ALLOWED_ORIGINS.has(effectiveOrigin)) {
    return new Response(
      JSON.stringify({
        status: "ERROR",
        code: "CSRF_ORIGIN_MISMATCH",
        message: "Origin not allowed for state-changing request.",
        action: "NONE",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  }

  // Passed CSRF checks
  return null;
}
