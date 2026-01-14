/*
 * File-ID: ID-10 (FINAL)
 * File-Path: supabase/functions/api/pipeline/requestId.ts
 * Gate: 1
 * Phase: 1
 * Domain: OBSERVABILITY
 * Purpose: Deterministic requestId injection WITHOUT breaking Edge body streams
 * Authority: Backend
 *
 * SSOT RULES:
 * - MUST NOT recreate Request object
 * - MUST NOT read or clone request body
 * - MUST preserve original Request stream integrity
 * - requestId is metadata ONLY, never part of transport
 */

function generateRequestId(): string {
  return crypto.randomUUID();
}

export function attachRequestId(req: Request): Request {
  // ─────────────────────────────────────────
  // 1️⃣ Resolve or generate requestId
  // ─────────────────────────────────────────
  const requestId =
    req.headers.get("X-Request-Id") ||
    req.headers.get("x-request-id") ||
    generateRequestId();

  // ─────────────────────────────────────────
  // 2️⃣ Attach to request (in-memory only)
  //     DO NOT mutate headers
  //     DO NOT recreate Request
  // ─────────────────────────────────────────
  (req as unknown as { _requestId?: string })._requestId = requestId;

  // ─────────────────────────────────────────
  // 3️⃣ Return original Request (body intact)
  // ─────────────────────────────────────────
  return req;
}
