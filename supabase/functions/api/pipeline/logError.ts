/*
 * File-ID: ID-10A
 * File-Path: supabase/functions/api/pipeline/logError.ts
 * Gate: 1
 * Phase: 1
 * Domain: OBSERVABILITY
 * Purpose: Structured error logging for RCA
 * Authority: Backend
 */

export function logError(
  req: Request,
  stage: string,
  code: string
) {
  const requestId = (req as any)._requestId;

  console.error(
    JSON.stringify({
      requestId: requestId ?? "UNKNOWN",
      stage,
      code,
      timestamp: new Date().toISOString(),
    })
  );
}
