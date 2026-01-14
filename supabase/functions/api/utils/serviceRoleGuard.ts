/*
 * File-ID: ID-12A
 * File-Path: supabase/functions/api/utils/serviceRoleGuard.ts
 * Gate: 1
 * Phase: 1
 * Domain: DB
 * Purpose: Assert DB execution context is trusted (service_role key)
 * Authority: Backend
 */

export function assertServiceRole(_context: {
  source: "API" | "CRON" | "SYSTEM";
}): void {
  /*
    IMPORTANT DESIGN NOTE (LOCKED):

    - This function DOES NOT check user roles (SA / GA / etc)
    - Business authorization is handled elsewhere (ACL / handlers)
    - If this code is executing, it is already running under
      SUPABASE_SERVICE_ROLE_KEY (Edge Function context)

    Therefore:
    - No role comparison
    - No conditional logic
    - Presence of this function is an explicit trust boundary
  */

  return;
}
