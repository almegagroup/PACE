/*
 * File-ID: ID-2.7 + ID-4.2B (FINAL)
 * File-Path: supabase/functions/api/utils/authAudit.ts
 *
 * Purpose:
 * --------
 * - Centralized, best-effort audit logger for AUTH & SIGNUP governance
 * - Uses SECURITY DEFINER RPC to avoid schema exposure issues
 * - Never blocks auth / admin flow under any circumstance
 *
 * Authority:
 * ----------
 * Backend ONLY (service_role)
 *
 * Stability:
 * ----------
 * - Production safe
 * - Local / Prod parity
 * - No schema assumptions
 * - No RLS leakage
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* -------------------------------------------------------------------------- */
/* ENV                                                                         */
/* -------------------------------------------------------------------------- */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_ENV_MISSING");
}

/* -------------------------------------------------------------------------- */
/* Dedicated backend-only client                                               */
/* -------------------------------------------------------------------------- */
const auditClient = createClient(
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

/* -------------------------------------------------------------------------- */
/* Utilities                                                                   */
/* -------------------------------------------------------------------------- */
async function hashIdentifier(input?: string | null): Promise<string | null> {
  if (!input) return null;

  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );

  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/* -------------------------------------------------------------------------- */
/* AUTH EVENT LOGGER (Gate-2 / Gate-4)                                         */
/* -------------------------------------------------------------------------- */
export async function logAuthEvent(params: {
  eventType:
    | "LOGIN_SUCCESS"
    | "LOGIN_FAILED"
    | "RATE_LIMITED"
    | "LOGOUT"
    | "SIGNUP_REQUEST"
    | "STATUS_CHECK"
    | "FIRST_LOGIN_REQUIRED"
    | "FIRST_LOGIN_COMPLETED"
    | "LOGIN_BLOCKED_ACL";
  identifier?: string | null;
  requestId?: string | null;
  result: "OK" | "FAILED" | "BLOCKED";
}) {
  try {
    const identifierHash = await hashIdentifier(params.identifier);

    const { error } = await auditClient.rpc("log_auth_event", {
      p_event_type: params.eventType,
      p_identifier_hash: identifierHash,
      p_secondary_identifier_hash: null,
      p_target_id: null,
      p_request_id: params.requestId ?? null,
      p_result: params.result,
      p_gate: 4,
      p_source: "auth",
    });

    // 🔕 Silent by default — enable only if diagnosing prod incident
    if (error) {
      console.error("[AUDIT_RPC_FAILED][AUTH]", error);
    }
  } catch {
    // 🔒 SSOT RULE:
    // Audit must NEVER break auth flow
  }
}

/* -------------------------------------------------------------------------- */
/* SIGNUP / GOVERNANCE EVENT LOGGER (Gate-4)                                   */
/* -------------------------------------------------------------------------- */
type ApprovalAction =
  | "SIGNUP_APPROVED"
  | "SIGNUP_REJECTED"
  | "USER_CREATED_FROM_SIGNUP";

export async function logSignupGovernanceEvent(params: {
  action: ApprovalAction;
  actor_identifier: string;        // SA identifier
  target_signup_id: string;        // UUID
  target_user_identifier?: string; // optional
  result: "OK" | "FAILED";
  requestId?: string | null;
}) {
  try {
    const actorHash = await hashIdentifier(params.actor_identifier);
    const targetUserHash = await hashIdentifier(
      params.target_user_identifier
    );

    const { error } = await auditClient.rpc("log_auth_event", {
      p_event_type: params.action,
      p_identifier_hash: actorHash,
      p_secondary_identifier_hash: targetUserHash ?? null,
      p_target_id: params.target_signup_id,
      p_request_id: params.requestId ?? null,
      p_result: params.result,
      p_gate: 4,
      p_source: "auth",
    });

    // 🔕 Silent by default — enable only if diagnosing prod incident
    if (error) {
      console.error("[AUDIT_RPC_FAILED][GOVERNANCE]", error);
    }
  } catch {
    // 🔒 Best-effort only
  }
}
