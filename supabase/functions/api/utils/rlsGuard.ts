/*
 * File-ID: ID-12
 * File-Path: supabase/functions/api/utils/rlsGuard.ts
 * Gate: 1
 * Phase: 1
 * Domain: DB
 * Purpose: RLS enforcement assertion before any DB access
 * Authority: Backend
 */

/**
 * Gate-1 NOTE:
 * - No DB queries here
 * - No Supabase client
 * - This is a mandatory assertion hook for future DB access
 */

export function assertRlsPrecondition(context: {
  serviceRole: boolean;
  rlsExpected: boolean;
}) {
  // Service role must be used
  if (!context.serviceRole) {
    throw new Error(
      "SECURITY_VIOLATION: Database access without service role is forbidden."
    );
  }

  // RLS must be assumed ON (policy-level contract)
  if (!context.rlsExpected) {
    throw new Error(
      "SECURITY_VIOLATION: RLS precondition not satisfied before DB access."
    );
  }

  // Gate-1: assertion only, no runtime effect
  return true;
}
