/*
 * File-ID: ID-1A-O
 * File-Path: supabase/functions/api/pipeline/origins.ts
 * Gate: 1
 * Phase: 1
 * Domain: SECURITY
 * Purpose: Single Source of Truth for allowed browser origins
 * Authority: Backend
 *
 * RULES:
 * - Production origins MUST come from environment
 * - No hard-coded domains allowed
 * - Fail fast if env is missing (no silent allow)
 */

export function getAllowedOrigins(): Set<string> {
  const raw = Deno.env.get("SECURITY_ALLOWED_ORIGINS");

  if (!raw) {
    throw new Error("SECURITY_ALLOWED_ORIGINS env not set");
  }

  return new Set(
    raw
      .split(",")
      .map(o => o.trim())
      .filter(Boolean)
  );
}
