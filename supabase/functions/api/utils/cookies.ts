/*
 * File-ID: ID-2.2A
 * File-Path: supabase/functions/api/utils/cookie.ts
 * Gate: 2
 * Phase: 2
 * Domain: AUTH / TRANSPORT
 * Purpose:
 *  - Build HttpOnly session cookie strings
 *  - Centralized, reusable cookie construction
 * Authority: Backend (SSOT)
 *
 * Notes:
 *  - No auth logic here
 *  - No DB access
 *  - No request handling
 *  - Used only by response layer
 */

/*
 ─────────────────────────────────────────────
  Cookie builders
 ─────────────────────────────────────────────
*/

/**
 * Build active session cookie
 * Used after successful login
 */
/* ============================================================================
 * SECURITY CONTRACT (Gate-3.6A):
 * ---------------------------------------------------------------------------
 * - This function MUST be used only after successful authentication.
 * - It ALWAYS represents a freshly generated session cookie.
 * - It MUST overwrite any existing pace_session cookie on the client.
 * - Reusing or conditionally skipping this cookie on login is forbidden.
 * ============================================================================
 */

export function buildFreshSessionCookie(opts: {
  sessionId: string;
  domain: string;
  maxAge: number; // seconds
  secure: boolean;
}): string {
  const parts: string[] = [
    `pace_session=${opts.sessionId}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${opts.maxAge}`,
    `Domain=${opts.domain}`,
  ];

  if (opts.secure) {
    parts.push(`Secure`);
  }

  return parts.join("; ");
}

/**
 * Build expired cookie (logout / force logout)
 */
export function buildExpiredSessionCookie(domain: string): string {
  return [
    `pace_session=`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=0`,
    `Domain=${domain}`,
  ].join("; ");
}
