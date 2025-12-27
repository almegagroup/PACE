/*
 * File-ID: ID-2.7
 * Purpose: Minimal auth audit logger (best-effort)
 * Authority: Backend (SSOT)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_ENV_MISSING");
}

// 🔑 Dedicated client ONLY for audit logs
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
).schema("public");

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

export async function logAuthEvent(params: {
  eventType: "LOGIN_SUCCESS" | "LOGIN_FAILED" | "RATE_LIMITED" | "LOGOUT" | "SIGNUP_REQUEST";
  identifier?: string | null;
  ip?: string | null;
  requestId?: string | null;
  result: "OK" | "FAILED" | "BLOCKED";
}) {
  try {
    const identifierHash = await hashIdentifier(params.identifier);

    await auditClient.from("auth_audit_logs").insert({
      event_type: params.eventType,
      identifier_hash: identifierHash,
      ip_address: params.ip ?? null,
      request_id: params.requestId ?? null,
      result: params.result,
      gate: 4,
      source: "auth",
    });
  } catch {
    // Gate-2 rule: NEVER block auth flow
  }
}
