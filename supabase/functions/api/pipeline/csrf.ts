/*
 * File-ID: ID-4 (FINAL)
 * File-Path: supabase/functions/api/pipeline/csrf.ts
 * Gate: 1
 * Phase: 1
 * Domain: SECURITY
 * Purpose: CSRF protection using Origin/Referer validation
 * Authority: Backend
 *
 * SSOT RULES:
 * - CSRF applies ONLY to user-facing state-changing routes
 * - Admin / governance routes are SESSION + ROLE protected
 * - CSRF MUST NOT block admin automation or governance
 */

import { getAllowedOrigins } from "./origins.ts";
import { logError } from "./logError.ts";

// ─────────────────────────────────────────
// SAFE METHODS (no CSRF required)
// ─────────────────────────────────────────
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// ─────────────────────────────────────────
// CSRF BYPASS PATHS (CRITICAL)
// ─────────────────────────────────────────
const CSRF_BYPASS_PATH_PREFIXES = [
  "/api/admin/",      // Admin governance
  "/api/internal/",   // Future internal automations
];

// ─────────────────────────────────────────
// Helper: extract origin from referer
// ─────────────────────────────────────────
function extractOriginFromReferer(
  referer: string | null
): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────
// CSRF Middleware
// ─────────────────────────────────────────
export async function applyCSRF(
  req: Request
): Promise<Response | null> {

  // ⚠️ IMPORTANT:
  // Env access MUST be inside request lifecycle
  const ALLOWED_ORIGINS = getAllowedOrigins();

  const path = new URL(req.url).pathname;

  // ─────────────────────────────────────────
  // 1️⃣ Bypass CSRF for admin / internal routes
  // ─────────────────────────────────────────
  if (
    CSRF_BYPASS_PATH_PREFIXES.some(prefix =>
      path.startsWith(prefix)
    )
  ) {
    return null;
  }

  // ─────────────────────────────────────────
  // 2️⃣ Safe HTTP methods bypass
  // ─────────────────────────────────────────
  if (SAFE_METHODS.has(req.method)) {
    return null;
  }

  // ─────────────────────────────────────────
  // 3️⃣ Extract origin
  // ─────────────────────────────────────────
  const origin = req.headers.get("Origin");
  const referer = req.headers.get("Referer");

  const effectiveOrigin =
    origin ?? extractOriginFromReferer(referer);

  // ─────────────────────────────────────────
  // 4️⃣ Block if no origin (state-changing)
  // ─────────────────────────────────────────
  if (!effectiveOrigin) {
    logError(req, "CSRF", "CSRF_MISSING_ORIGIN");

    return new Response(
      JSON.stringify({
        status: "ERROR",
        code: "CSRF_MISSING_ORIGIN",
        message:
          "Missing Origin/Referer for state-changing request.",
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

  // ─────────────────────────────────────────
  // 5️⃣ Validate origin allowlist
  // ─────────────────────────────────────────
  if (!ALLOWED_ORIGINS.has(effectiveOrigin)) {
    logError(req, "CSRF", "CSRF_ORIGIN_MISMATCH");

    return new Response(
      JSON.stringify({
        status: "ERROR",
        code: "CSRF_ORIGIN_MISMATCH",
        message:
          "Origin not allowed for state-changing request.",
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

  // ─────────────────────────────────────────
  // 6️⃣ Passed CSRF checks
  // ─────────────────────────────────────────
  return null;
}
