/*
 * File-ID: ID-2B (FINAL — LOCKED)
 * File-Path: supabase/functions/api/pipeline/headers.ts
 * Gate: 1
 * Phase: 1
 * Domain: SECURITY
 * Purpose: NO request-side security header validation
 *
 * NOTE:
 * - Browsers NEVER send CSP / X-Frame-Options headers
 * - These are RESPONSE headers only
 * - Validation is INVALID at request stage
 *
 * Authority: Backend
 */

export async function applySecurityHeaders(
  _req: Request
): Promise<Response | null> {
  // 🚫 DO NOTHING HERE
  // Security headers are injected in finalizeResponse()
  // Request-side validation is architecturally incorrect

  return null;
}
