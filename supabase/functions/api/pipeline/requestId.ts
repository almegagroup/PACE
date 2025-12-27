/*
 * File-ID: ID-10
 * File-Path: supabase/functions/api/pipeline/requestId.ts
 * Gate: 1
 * Phase: 1
 * Domain: OBSERVABILITY
 * Purpose: Inject and propagate requestId for traceability
 * Authority: Backend
 */

function generateRequestId(): string {
  return crypto.randomUUID();
}

export function attachRequestId(req: Request): Request {
  const headers = new Headers(req.headers);

  const incomingId =
    headers.get("X-Request-Id") ||
    headers.get("x-request-id");

  const requestId = incomingId || generateRequestId();

  headers.set("X-Request-Id", requestId);

  const wrapped = new Request(req, { headers });

  // attach to request for downstream usage
  (req as any)._requestId = requestId;

  return wrapped;
}
