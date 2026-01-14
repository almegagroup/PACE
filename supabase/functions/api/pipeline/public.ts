/*
 * File-ID: ID-11A
 * File-Path: supabase/functions/api/pipeline/public.ts
 * Gate: 1
 * Phase: 1
 * Domain: SECURITY
 * Purpose: Guard bypass ban — assert only explicit public auth endpoints can bypass pipeline
 * Authority: Backend
 */

export function isPublicPath(req: Request): boolean {
  let path = new URL(req.url).pathname;

  // Normalize
  if (path.startsWith("/api")) {
    path = path.slice(4);
  }

  // 🚫 HARD BAN: admin namespace can NEVER be public
  if (path.startsWith("/admin")) {
    return false;
  }

  // ✅ Explicit public endpoints only
  return (
    path === "/health" ||
    path === "/auth/login" ||
    path === "/auth/signup-request" ||
    path === "/auth/status-check" ||
    path === "/auth/first-login" ||
    path === "/auth/human-challenge" ||
    path === "/auth/forgot-password" ||
    path === "/auth/forgot-passcode" ||
    path === "/auth/reset-request" ||
    path === "/auth/reset-complete"
  );
}


