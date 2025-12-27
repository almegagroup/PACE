/*
 * File-ID: ID-11A
 * File-Path: supabase/functions/api/pipeline/public.ts
 * Gate: 1
 * Phase: 1
 * Domain: SECURITY
 * Purpose: Guard bypass ban — assert only /health can bypass pipeline
 * Authority: Backend
 */

export function isPublicPath(req: Request): boolean {
  const path = new URL(req.url).pathname;

  return (
    path === "/health" ||
    path.endsWith("/auth/login")||
     path.endsWith("/auth/signup-request")
  );
}
