/*
 * File-ID: ID-4.2 (FINAL)
 * File-Path: supabase/functions/api/domains/admin/signup/approval.handler.ts
 * Gate: 4
 * Phase: 4
 * Domain: ADMIN
 * Purpose: Super Admin approval / rejection of signup requests
 * Authority: Backend
 */

import { apiResponse, Action } from "../../../utils/response.ts";
import { logSignupGovernanceEvent } from "../../../utils/authAudit.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";
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
// Handler
// -----------------------------------------------------------------------------
export async function signupApprovalHandler(
  req: Request,
  args: { context: RequestContext }
): Promise<Response> {
  const ctx = args.context;

  console.log("[APPROVAL_HANDLER_ENTER]", {
    identifier: ctx.identifier,
  });

  // ─────────────────────────────────────────
// 1️⃣ Read payload from SSOT body parser
// ─────────────────────────────────────────
const payload = (req as any)._body;

if (!payload) {
  console.log("[APPROVAL_INVALID_PAYLOAD]");
  return generic();
}

console.log("[APPROVAL_PAYLOAD]", payload);

// 2️⃣ Validate
const { signup_request_id, decision, reason } = payload;

if (
  typeof signup_request_id !== "string" ||
  (decision !== "APPROVE" && decision !== "REJECT")
) {
  console.log("[APPROVAL_INVALID_PAYLOAD]");
  return generic();
}

  // ─────────────────────────────────────────
  // 2️⃣ Context validation
  // ─────────────────────────────────────────
  if (!ctx.identifier) {
    console.log("[APPROVAL_NO_CONTEXT_IDENTIFIER]");
    return generic();
  }

  // ─────────────────────────────────────────
  // 3️⃣ Service-role Supabase client
  // ─────────────────────────────────────────
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // ─────────────────────────────────────────
    // 3A️⃣ SA verification
    // ─────────────────────────────────────────
    const { data: saUser, error: saErr } = await supabase
      .schema("secure")
      .from("auth_users")
      .select("identifier,is_sa")
      .eq("identifier", ctx.identifier)
      .single();

    console.log("[SA_CHECK]", { saUser, saErr });

    if (saErr || !saUser || saUser.is_sa !== true) {
      console.log("[APPROVAL_NOT_SA]");
      return generic();
    }

    // ─────────────────────────────────────────
    // 4️⃣ Load signup request
    // ─────────────────────────────────────────
    const { data: reqRow, error: reqErr } = await supabase
      .schema("public")
      .from("auth_signup_requests")
      .select("id,state,email")
      .eq("id", signup_request_id)
      .single();

    console.log("[SIGNUP_ROW]", { reqRow, reqErr });

    if (reqErr || !reqRow || reqRow.state !== "REQUESTED") {
      console.log("[SIGNUP_INVALID_STATE]");
      return generic();
    }

    // ─────────────────────────────────────────
    // 5️⃣ APPLY DECISION
    // ─────────────────────────────────────────
    if (decision === "APPROVE") {
      const { error } = await supabase
        .schema("public")
        .from("auth_signup_requests")
        .update({
          state: "APPROVED_SETUP_PENDING",
          approved_by: ctx.identifier,
          approved_at: new Date().toISOString(),
        })
        .eq("id", signup_request_id)
        .eq("state", "REQUESTED");

      if (error) {
        console.log("[APPROVAL_UPDATE_FAILED]", error);
        return generic();
      }

      await logSignupGovernanceEvent({
        action: "SIGNUP_APPROVED",
        actor_identifier: ctx.identifier,
        target_signup_id: signup_request_id,
        result: "OK",
        requestId: req.headers.get("X-Request-Id") ?? undefined,
      });
    }

    if (decision === "REJECT") {
      const { error } = await supabase
        .schema("public")
        .from("auth_signup_requests")
        .update({
          state: "REJECTED",
          rejected_by: ctx.identifier,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason ?? null,
        })
        .eq("id", signup_request_id)
        .eq("state", "REQUESTED");

      if (error) {
        console.log("[REJECT_UPDATE_FAILED]", error);
        return generic();
      }

      await logSignupGovernanceEvent({
        action: "SIGNUP_REJECTED",
        actor_identifier: ctx.identifier,
        target_signup_id: signup_request_id,
        result: "OK",
        requestId: req.headers.get("X-Request-Id") ?? undefined,
      });
    }
  } catch (err) {
    console.error("[APPROVAL_HANDLER_FATAL]", err);
  }

  // ─────────────────────────────────────────
  // 6️⃣ Enumeration-safe response
  // ─────────────────────────────────────────
  return generic();
}

// -----------------------------------------------------------------------------
// Generic response
// -----------------------------------------------------------------------------
function generic(): Response {
  return apiResponse({
    status: "OK",
    code: "REQUEST_PROCESSED",
    message: "Request processed",
    action: Action.NONE,
  });
}
