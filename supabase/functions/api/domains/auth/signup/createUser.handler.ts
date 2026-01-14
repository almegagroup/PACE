/*
 * File-ID: ID-4.2A
 * File-Path: supabase/functions/api/domains/admin/signup/createUser.handler.ts
 * Gate: 4
 * Phase: 4
 * Domain: ADMIN
 * Purpose: Atomic AUTH identity creation after SA approval
 * Authority: Backend (service_role execution context)
 *
 * SSOT RULES (LOCKED):
 * - auth_users        → identity + role only
 * - auth_credentials → password + passcode hashes ONLY
 * - Hashing           → Postgres pgcrypto ONLY (via DB function)
 */

import { apiResponse, Action } from "../../../utils/response.ts";
import { logSignupGovernanceEvent } from "../../../utils/authAudit.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { RequestContext } from "../../../pipeline/context.ts";

// -----------------------------------------------------------------------------
// ENV
// -----------------------------------------------------------------------------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_ENV_MISSING");
}

// -----------------------------------------------------------------------------
// Helpers (NON-CRYPTO)
// -----------------------------------------------------------------------------
function genRandom(len: number, chars: string): string {
  return Array.from({ length: len }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

function generateTempPassword(): string {
  return genRandom(
    10,
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%"
  );
}

function generatePasscode(): string {
  return genRandom(
    8,
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
  );
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------
export async function createUserFromSignupHandler(
  req: Request,
  args: { context: RequestContext }
): Promise<Response> {
  const ctx = args.context;

  /*
   ─────────────────────────────────────────
   1️⃣ Parse payload (silent, enumeration-safe)
   ─────────────────────────────────────────
  */
  const payload = (req as any)._body;
if (!payload) return generic();

const { signup_request_id } = payload;
if (typeof signup_request_id !== "string") return generic();

  /*
   ─────────────────────────────────────────
   2️⃣ Service-role Supabase client
   ─────────────────────────────────────────
   DB execution privilege is guaranteed by SERVICE_ROLE_KEY.
  */
  const supabase = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

  /*
   ─────────────────────────────────────────
   3️⃣ Verify ACTOR (BUSINESS AUTH — SA ONLY)
   ─────────────────────────────────────────
  */
  if (!ctx.identifier) {
    return generic();
  }

  const { data: saUser, error: saErr } = await supabase
    .schema("secure")
    .from("auth_users")
    .select("identifier,is_sa")
    .eq("identifier", ctx.identifier)
    .single();

  if (saErr || !saUser || saUser.is_sa !== true) {
    // Not Super Admin → silent reject
    return generic();
  }

  try {
    /*
     ─────────────────────────────────────────
     4️⃣ Load APPROVED signup request
     ─────────────────────────────────────────
    */
    const { data: reqRow, error: reqErr } = await supabase
      .from("auth_signup_requests")
      .select("id,phone,email,state")
      .eq("id", signup_request_id)
      .eq("state", "APPROVED_SETUP_PENDING")
      .single();

    if (reqErr || !reqRow) {
      throw new Error("INVALID_SIGNUP_STATE");
    }

    /*
     ─────────────────────────────────────────
     5️⃣ Prepare identity + secrets
     ─────────────────────────────────────────
    */
    const identifier = `${reqRow.phone}@pace.in`;
    const tempPassword = generateTempPassword();
    const passcode = generatePasscode();

    /*
     ─────────────────────────────────────────
     6️⃣ Create auth_users (IDENTITY ONLY)
     ─────────────────────────────────────────
    */
    const { data: userRow, error: uErr } = await supabase
      .schema("secure")
      .from("auth_users")
      .insert({
        identifier,
        email: reqRow.email,
        role_code: "L1_USER",
        role_rank: 10,
        is_sa: false,
        is_ga: false,
        is_active: true,
        state: "FIRST_LOGIN_REQUIRED",
      })
      .select("id")
      .single();

    if (uErr || !userRow) {
      throw uErr;
    }

    /*
     ─────────────────────────────────────────
     7️⃣ Create credentials (DB-side hashing)
     ─────────────────────────────────────────
    */
    const { error: credErr } = await supabase
  .schema("secure")
  .rpc("create_auth_credentials", {
    p_user_id: userRow.id,
    p_password: tempPassword,
    p_passcode: passcode,
  });

    if (credErr) {
      throw credErr;
    }

    /*
     ─────────────────────────────────────────
     8️⃣ Mark signup request as CONSUMED
     ─────────────────────────────────────────
    */
    await supabase
  .from("auth_signup_requests")
  .update({
    state: "SET_FIRST_LOGIN",
  })
  .eq("id", signup_request_id);

    /*
     ─────────────────────────────────────────
     9️⃣ Audit (NO plaintext secrets)
     ─────────────────────────────────────────
    */
    await logSignupGovernanceEvent({
      action: "USER_CREATED_FROM_SIGNUP",
      actor_identifier: ctx.identifier,
      target_signup_id: signup_request_id,
      target_user_identifier: identifier,
      result: "OK",
      requestId: req.headers.get("X-Request-Id") ?? undefined,
    });
  } catch (err) {
  console.error("[CREATE_USER_FATAL]", err);
  throw err;
}

  /*
   ─────────────────────────────────────────
   🔟 Enumeration-safe response
   ─────────────────────────────────────────
  */
  return generic();
}

// -----------------------------------------------------------------------------
// Generic SSOT response
// -----------------------------------------------------------------------------
function generic(): Response {
  return apiResponse({
    status: "OK",
    code: "REQUEST_PROCESSED",
    message: "Request processed",
    action: Action.NONE,
  });
}
