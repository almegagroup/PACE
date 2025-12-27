/*
 * File-ID: ID-12A
 * File-Path: supabase/functions/api/utils/serviceRoleGuard.ts
 * Gate: 1
 * Phase: 1
 * Domain: DB
 * Purpose: Assert only service role can execute DB queries
 * Authority: Backend
 */

export function assertServiceRole(context: {
  role?: string;
  source: "API" | "CRON" | "SYSTEM";
}): void {
  const role = context.role;

  // 🚨 Hard fail on missing role
  if (!role) {
    throw new Error(
      "SECURITY_VIOLATION: Missing role during DB access assertion"
    );
  }

  // 🚨 Only service_role is allowed
  if (role !== "service_role") {
    throw new Error(
      `SECURITY_VIOLATION: DB access denied for role=${role}`
    );
  }

  // ✅ service_role explicitly allowed
}
