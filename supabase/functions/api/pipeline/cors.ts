/*
 * File-ID: ID-3A (FINAL)
 * File-Path: supabase/functions/api/pipeline/cors.ts
 * Gate: 1
 * Phase: 1
 * Domain: SECURITY
 * Purpose: Deterministic CORS handling with credential support
 * Authority: Backend
 *
 * SSOT RULES:
 * - NEVER use wildcard (*) with credentials
 * - ALWAYS echo allowed Origin
 * - Preflight (OPTIONS) AND actual response must both carry CORS headers
 * - Actual response headers are injected by finalizeResponse()
 * - Middleware only DECIDES and ANNOTATES (_cors), never mutates response body
 */

import { getAllowedOrigins } from "./origins.ts";

type CorsMeta = {
  allowedOrigin?: string;
};

export async function applyCORS(
  req: Request
): Promise<Response | null> {

  // ⚠️ IMPORTANT:
  // Env access MUST be inside request lifecycle (Supabase Edge rule)
  const ALLOWED_ORIGINS = getAllowedOrigins();

  const origin = req.headers.get("Origin");

  // ─────────────────────────────────────────
  // 1️⃣ Non-browser / same-origin requests
  //    (curl, server-to-server, cron, etc.)
  // ─────────────────────────────────────────
  if (!origin) {
    return null;
  }

  // ─────────────────────────────────────────
  // 2️⃣ Origin allow-list enforcement
  // ─────────────────────────────────────────
  if (!ALLOWED_ORIGINS.has(origin)) {
    return new Response(
      JSON.stringify({
        status: "ERROR",
        code: "CORS_ORIGIN_DENIED",
        message: "Origin not allowed by CORS policy.",
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
  // 3️⃣ Attach CORS meta for ALL browser requests
  //    (OPTIONS + POST + GET + etc.)
  //    Applied later by finalizeResponse()
  // ─────────────────────────────────────────
  (req as unknown as { _cors?: CorsMeta })._cors = {
    allowedOrigin: origin,
  };

  // ─────────────────────────────────────────
  // 4️⃣ Preflight handling (OPTIONS)
  // ─────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, X-Request-Id",
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
        "Cache-Control": "no-store",
      },
    });
  }

  // ─────────────────────────────────────────
  // 5️⃣ Non-OPTIONS requests continue pipeline
  //    Headers injected centrally
  // ─────────────────────────────────────────
  return null;
}
