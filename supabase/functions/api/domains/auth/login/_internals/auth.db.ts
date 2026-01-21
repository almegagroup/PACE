// ============================================================================
// PACE-ERP :: AUTH DOMAIN (INTERNAL)
// Gate  : 2 (AUTH)
// File  : auth.db.ts
// Role  : Service-db accessor (Audit + Auth internals only)
// Status: TEMP (Gate-3 will replace with hardened adapter)
// ----------------------------------------------------------------------------
// SSOT RULES:
// - Service-role ONLY
// - No frontend exposure
// - RLS bypass is intentional (Gate-0 / Gate-2 rule)
// - Currently scoped ONLY for auth_audit_logs + auth internals
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";
import { logSessionTransition } from "./session.timeline.ts";

// -----------------------------------------------------------------------------
// ENV (Injected automatically by Supabase Edge Runtime)
// -----------------------------------------------------------------------------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY =
  Deno.env.get("SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_ENV_MISSING");
}

// -----------------------------------------------------------------------------
// Service-role Supabase client
// - No session persistence
// - No token refresh
// - No URL session detection
// -----------------------------------------------------------------------------
const serviceClient = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

// -----------------------------------------------------------------------------
// getServiceDb
// -----------------------------------------------------------------------------
// Gate-2 NOTE:
// - auth_audit_logs lives in PUBLIC schema
// - Using service role => safe even in public schema
// - This accessor MUST NOT be used for business / ACL data
// -----------------------------------------------------------------------------
export function getServiceDb() {
  return serviceClient.schema('secure');
}
// ============================================================================
// Gate-3 Helper: getSessionById
// ----------------------------------------------------------------------------
// Reads ERP session by ID
// - Service role only
// - No RLS (intentional)
// - Returns null if not found
// ============================================================================
export async function getSessionById(sessionId: string) {
  const { data, error } = await getServiceDb()
    .from("erp_sessions")
    .select("*")
    .eq("id", sessionId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[Gate-3] getSessionById failed", error);
    return null;
  }

  return data;
}
// ============================================================================
// Gate-3 Helper: markSessionIdle
// ----------------------------------------------------------------------------
// Marks session as IDLE
// - ONLY if current state is ACTIVE
// - Must NEVER throw or block request
// ============================================================================
export async function markSessionIdle(sessionId: string) {
  const { error } = await getServiceDb()
    .from("erp_sessions")
    .update({
      state: "IDLE",
    })
    .eq("id", sessionId)
    .eq("state", "ACTIVE"); // safety guard

  if (error) {
    // Non-blocking by design (Idle marking must not break auth)
    console.error("[Gate-3] markSessionIdle failed", error);
  }
}
// ============================================================================
// Gate-3 Helper: markSessionExpired
// ----------------------------------------------------------------------------
// Marks session as EXPIRED (Idle → Logout path)
// - Called when IDLE session is encountered
// - Non-blocking
// ============================================================================
export async function markSessionExpired(sessionId: string) {
  const { error } = await getServiceDb()
    .from("erp_sessions")
    .update({
      state: "EXPIRED",
      revoked_at: new Date().toISOString(),
      revoked_reason: "IDLE_TIMEOUT",
    })
    .eq("id", sessionId)
    .in("state", ["ACTIVE", "IDLE"]); // safety

  if (error) {
    console.error("[Gate-3] markSessionExpired failed", error);
  }
}
// auth.db.ts
export async function touchSessionActivity(sessionId: string) {
  const { error } = await getServiceDb()
    .from("erp_sessions")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) {
    console.error("[Gate-3] touchSessionActivity failed", error);
  }
}
// ============================================================================
// Gate-3.3 Helper: revokeOtherSessions
// ----------------------------------------------------------------------------
// Revokes all ACTIVE / IDLE sessions of a user except current one
// Reason: NEW_LOGIN
// Non-blocking but awaited by login flow
// ============================================================================
export async function revokeOtherSessions(
  userId: string,
  currentSessionId?: string
) {
  const q = getServiceDb()
    .from("erp_sessions")
    .update({
      state: "REVOKED",
      revoked_at: new Date().toISOString(),
      revoked_reason: "NEW_LOGIN",
    })
    .eq("user_id", userId)
    .in("state", ["ACTIVE", "IDLE"]);

  if (currentSessionId) {
    q.neq("id", currentSessionId);
  }

  const { error } = await q;
    // ─────────────────────────────────────────
  // ID-3.8 :: Session Timeline Log (NEW LOGIN REVOKE)
  // ─────────────────────────────────────────
  if (!error) {
  await logSessionTransition({
    sessionId: currentSessionId ?? "MULTI",
    userId,
    fromState: "ACTIVE_OR_IDLE",
    toState: "REVOKED",
    event: "NEW_LOGIN",
    source: "login.handler",
  });
}


  if (error) {
    console.error("[Gate-3.3] revokeOtherSessions failed", error);
  }
}
// ============================================================================
// Gate-3.4 Helper: adminForceRevokeSessions
// ----------------------------------------------------------------------------
// Revokes ALL ACTIVE / IDLE sessions of a user
// Called ONLY by SA
// ============================================================================

// ============================================================================
// Gate-3.4 Helper: adminForceRevokeSessions
// ----------------------------------------------------------------------------
// Revokes ALL ACTIVE / IDLE sessions of a user
// Reason: ADMIN_FORCE_REVOKE
// Called ONLY by Super Admin
// ============================================================================

export async function adminForceRevokeSessions(
  targetUserId: string,
  adminUserId: string
) {
  const { error } = await getServiceDb()
    .from("erp_sessions")
    .update({
      state: "REVOKED",
      revoked_at: new Date().toISOString(),
      revoked_reason: "ADMIN_FORCE_REVOKE",
      revoked_by: `SA:${adminUserId}`,
    })
    .eq("user_id", targetUserId)
    .in("state", ["ACTIVE", "IDLE"]);
      // ─────────────────────────────────────────
  // ID-3.8 :: Session Timeline Log (ADMIN FORCE REVOKE)
  // ─────────────────────────────────────────
  if (!error) {
  await logSessionTransition({
    sessionId: "MULTI",
    userId: targetUserId,
    fromState: "ACTIVE_OR_IDLE",
    toState: "REVOKED",
    event: "ADMIN_FORCE_REVOKE",
    source: "admin",
  });
}

  if (error) {
    console.error("[Gate-3.4] adminForceRevokeSessions failed", error);
  }
}
// ============================================================================
// Gate-3.5A Helper: getLastSessionDeviceTag
// ----------------------------------------------------------------------------
// Returns most recent device_tag for a user (excluding current session)
// Used ONLY for device change signal
// ============================================================================

export async function getLastSessionDeviceTag(
  userId: string,
  excludeSessionId?: string
) {
  let q = getServiceDb()
    .from("erp_sessions")
    .select("device_tag")
    .eq("user_id", userId)
    .not("device_tag", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (excludeSessionId) {
    q = q.neq("id", excludeSessionId);
  }

  const { data, error } = await q.maybeSingle();

  if (error) {
    console.error("[Gate-3.5A] getLastSessionDeviceTag failed", error);
    return null;
  }

  return data?.device_tag ?? null;
}
// -----------------------------------------------------------------------------
// Gate-4 Helper: getPublicDb
// -----------------------------------------------------------------------------
// Purpose:
// - ONLY for public tables like auth_signup_requests
// - Service role, RLS bypass
// - MUST NOT be used for auth/session tables
// -----------------------------------------------------------------------------
export function getPublicDb() {
  return serviceClient.schema("public");
}



