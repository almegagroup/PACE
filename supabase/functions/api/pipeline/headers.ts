/*
 * File-ID: ID-2B
 * File-Path: supabase/functions/api/pipeline/headers.ts
 * Gate: 1
 * Phase: 1
 * Domain: SECURITY
 * Purpose: Enforce strict CSP and validate X-Frame-Options consistency
 * Authority: Backend
 */

export async function applySecurityHeaders(
  req: Request
): Promise<Response | null> {
  const headers = new Headers(req.headers);

  // Base security headers
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-XSS-Protection", "0");
  headers.set("Cache-Control", "no-store");

  // STRICT CSP — explicit allowlist only
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'none'",
      "script-src 'self' https://erp.almegagroup.in http://localhost:5173",
      "style-src 'self' https://erp.almegagroup.in http://localhost:5173",
      "img-src 'self' https://erp.almegagroup.in http://localhost:5173 data:",
      "font-src 'self' https://erp.almegagroup.in http://localhost:5173",
      "connect-src 'self' https://erp.almegagroup.in http://localhost:5173",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'self' https://erp.almegagroup.in http://localhost:5173",
    ].join("; ")
  );

  // --- ID-2B: X-Frame-Options hard validation ---

  const csp = headers.get("Content-Security-Policy") || "";
  const xfo = headers.get("X-Frame-Options");

  if (!xfo) {
    return new Response(
      JSON.stringify({
        status: "ERROR",
        code: "SECURITY_HEADER_MISSING",
        message: "X-Frame-Options header must be present.",
        action: "NONE",
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers }
    );
  }

  if (xfo !== "DENY") {
    return new Response(
      JSON.stringify({
        status: "ERROR",
        code: "SECURITY_HEADER_INVALID",
        message: "X-Frame-Options must be DENY.",
        action: "NONE",
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers }
    );
  }

  if (!csp.includes("frame-ancestors 'none'")) {
    return new Response(
      JSON.stringify({
        status: "ERROR",
        code: "CSP_MISMATCH",
        message:
          "CSP must include frame-ancestors 'none' to match X-Frame-Options.",
        action: "NONE",
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers }
    );
  }

  // Attach hardened request for downstream pipeline
  const hardenedRequest = new Request(req, { headers });
  (req as unknown as { _hardened?: Request })._hardened = hardenedRequest;

  return null; // continue pipeline
}
