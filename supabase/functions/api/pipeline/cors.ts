/*
 * File-ID: ID-3A
 * File-Path: supabase/functions/api/pipeline/cors.ts
 * Gate: 1
 * Phase: 1
 * Domain: SECURITY
 * Purpose: Handle CORS preflight and set explicit CORS response headers
 * Authority: Backend
 */

const ALLOWED_ORIGINS = new Set<string>([
  "https://erp.almegagroup.in",
  "http://localhost:5173",
]);

type CorsMeta = {
  allowedOrigin?: string;
};

export async function applyCORS(
  req: Request
): Promise<Response | null> {
  const origin = req.headers.get("Origin");

  // Non-browser / same-origin requests
  if (!origin) {
    return null;
  }

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

  // Preflight handling
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
        "Cache-Control": "no-store",
      },
    });
  }

  // Attach allowed origin for final response mapping
  (req as unknown as { _cors?: CorsMeta })._cors = {
    allowedOrigin: origin,
  };

  return null;
}
