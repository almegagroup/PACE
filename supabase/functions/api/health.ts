/*
 * File-ID: ID-11
 * File-Path: supabase/functions/api/health.ts
 * Gate: 1
 * Phase: 1
 * Domain: OBSERVABILITY
 * Purpose: Public health check endpoint
 * Authority: Backend
 */

export function healthHandler(req: Request): Response {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });

  const requestId = (req as any)._requestId;
  if (requestId) {
    headers.set("X-Request-Id", requestId);
  }

  return new Response(
    JSON.stringify({
      status: "OK",
      service: "PACE-ERP",
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers,
    }
  );
}
