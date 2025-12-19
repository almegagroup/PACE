/*
 * File-ID: ID-1A
 * File-Path: supabase/functions/api/index.ts
 * Gate: 1
 * Phase: 1
 * Domain: BACKEND
 * Purpose: Deterministic request pipeline entry with fixed security order
 * Authority: Backend
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { applySecurityHeaders } from "./pipeline/headers.ts";
import { applyCORS } from "./pipeline/cors.ts";
import { applyCSRF } from "./pipeline/csrf.ts";
import { applyRateLimit } from "./pipeline/rateLimit.ts";
import { resolveSession } from "./pipeline/session.ts";
import { resolveContext } from "./pipeline/context.ts";
import { resolveACL } from "./pipeline/acl.ts";

serve(async (req: Request) => {
  let response: Response | null = null;

  // 1. Security Headers
  response = await applySecurityHeaders(req);
  if (response) return response;

  // 2. CORS
  response = await applyCORS(req);
  if (response) return response;

  // 3. CSRF
  response = await applyCSRF(req);
  if (response) return response;

  // 4. Rate Limit
  response = await applyRateLimit(req);
  if (response) return response;

  // 5. Session Resolver
  const sessionResult = await resolveSession(req);
  if (sessionResult.response) return sessionResult.response;

  // 6. Context Resolver
  const contextResult = await resolveContext(req, sessionResult);
  if (contextResult.response) return contextResult.response;

  // 7. ACL Resolver
  const aclResult = await resolveACL(req, contextResult);
  if (aclResult.response) return aclResult.response;

  // 8. Final Handler (temporary shell)

// base response headers
const responseHeaders = new Headers({
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
});

// Map CORS headers if present
const corsMeta = (req as any)._cors as { allowedOrigin?: string } | undefined;
if (corsMeta?.allowedOrigin) {
  responseHeaders.set("Access-Control-Allow-Origin", corsMeta.allowedOrigin);
  responseHeaders.set("Access-Control-Allow-Credentials", "true");
  responseHeaders.set("Vary", "Origin");
}

// Map security headers (existing ID-2 logic)
const hardenedReq = (req as any)._hardened as Request | undefined;
if (hardenedReq) {
  for (const [key, value] of hardenedReq.headers.entries()) {
    if (
      key === "content-security-policy" ||
      key === "x-frame-options" ||
      key === "referrer-policy" ||
      key === "x-content-type-options"
    ) {
      responseHeaders.set(key, value);
    }
  }
}
// --- ID-3B: No Wildcard CORS Guarantee (FAIL FAST) ---

const acaOrigin = responseHeaders.get("Access-Control-Allow-Origin");

// If CORS header exists, wildcard is strictly forbidden
if (acaOrigin === "*") {
  return new Response(
    JSON.stringify({
      status: "ERROR",
      code: "CORS_WILDCARD_FORBIDDEN",
      message:
        "Wildcard Access-Control-Allow-Origin is forbidden by security policy.",
      action: "NONE",
      timestamp: new Date().toISOString(),
    }),
    {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    }
  );
}


return new Response(
  JSON.stringify({
    status: "ERROR",
    code: "GATE_1_PIPELINE_ONLY",
    message: "Request pipeline active. No handlers enabled yet.",
    action: "NONE",
    timestamp: new Date().toISOString(),
  }),
  {
    status: 501,
    headers: responseHeaders,
  }
);

});
