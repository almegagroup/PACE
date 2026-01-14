/*
 * File-ID: ID-4.1
 * File-Path: supabase/functions/api/domains/admin/signup/list.handler.ts
 * Gate: 4
 * Phase: 4
 * Domain: ADMIN
 * Purpose: Super Admin view of pending signup requests
 * Authority: Backend
 */

import { apiResponse, Action } from "../../../utils/response.ts";
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
// Handler
// -----------------------------------------------------------------------------
export async function listSignupRequestsHandler(
  _req: Request,
  args: { context: RequestContext }
): Promise<Response> {
  const ctx = args.context;

  console.log("[SIGNUP_LIST_ENTER]", {
    identifier: ctx.identifier,
  });

  // ─────────────────────────────────────────
  // 1️⃣ Context validation
  // ─────────────────────────────────────────
  if (!ctx.identifier) {
    console.log("[SIGNUP_LIST_NO_IDENTIFIER]");
    return forbidden();
  }

  // ─────────────────────────────────────────
  // 2️⃣ Service-role Supabase client
  // ─────────────────────────────────────────
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // ─────────────────────────────────────────
    // 3️⃣ SA verification (DB is SSOT)
    // ─────────────────────────────────────────
    const { data: saUser, error: saErr } = await supabase
      .schema("secure")
      .from("auth_users")
      .select("identifier,is_sa")
      .eq("identifier", ctx.identifier)
      .single();

    console.log("[SIGNUP_LIST_SA_CHECK]", { saUser, saErr });

    if (saErr || !saUser || saUser.is_sa !== true) {
      console.log("[SIGNUP_LIST_NOT_SA]");
      return forbidden();
    }

    // ─────────────────────────────────────────
    // 4️⃣ Load pending signup requests
    // ─────────────────────────────────────────
    const { data, error } = await supabase
  .schema("public")
  .from("auth_signup_requests")
  .select(
    `
    id,
    name,
    phone,
    email,
    company_hint,
    department_hint,
    designation_hint,
    requested_at
    `
  )
  .eq("state", "REQUESTED")
  .order("requested_at", { ascending: false });


    if (error) {
      console.error("[SIGNUP_LIST_DB_ERROR]", error);
      return genericError();
    }

    // ─────────────────────────────────────────
    // 5️⃣ Return list
    // ─────────────────────────────────────────
    return apiResponse({
      status: "OK",
      code: "SIGNUP_REQUESTS_LIST",
      action: Action.NONE,
      data: data ?? [],
    });
  } catch (err) {
    console.error("[SIGNUP_LIST_FATAL]", err);
    return genericError();
  }
}

// -----------------------------------------------------------------------------
// Responses
// -----------------------------------------------------------------------------
function forbidden(): Response {
  return apiResponse(
    {
      status: "ERROR",
      code: "FORBIDDEN",
      message: "Not authorized",
      action: Action.NONE,
    },
    403
  );
}

function genericError(): Response {
  return apiResponse(
    {
      status: "ERROR",
      code: "REQUEST_FAILED",
      message: "Unable to process request",
      action: Action.NONE,
    },
    500
  );
}
