// ============================================================================
// PACE-ERP :: AUTH DOMAIN
// Gate  : 4
// ID    : 4.4 (Forgot Passcode)
// File  : forgotPasscode.handler.ts
// Status: FINAL – LOCKED – PLUG & PLAY
//
// RULES:
// - Public endpoint
// - Enumeration-safe (generic failure)
// - Human verification MANDATORY
// - User provides IDENTIFIER + PASSWORD
// - Passcode = exactly 8 chars (NO numeric-only rule)
// - Backend orchestration ONLY
// - DB RPC = single source of truth
// ============================================================================

import { apiResponse, Action } from "../../../utils/response.ts";
import { humanVerification } from "../../../utils/humanVerification/index.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

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
export async function forgotPasscodeHandler(req: Request): Promise<Response> {
  const body = (req as any)._body ?? null;

  const {
    identifier,          // MUST be full identifier (phone@pace.in)
    password,
    new_passcode,
    confirm_passcode,
    hv_attempt_id,
    hv_answer,
  } = body ?? {};
  console.log("[FPASSCODE][REQ_BODY]", {
  identifier,
  hasPassword: !!password,
  newPasscodeLen: new_passcode?.length,
  confirmMatch: new_passcode === confirm_passcode,
  hv_attempt_id,
  hv_answer,
});

  // ---------------------------------------------------------------------------
  // Basic validation (ENUMERATION-SAFE)
  // ---------------------------------------------------------------------------
  if (
    !identifier ||
    !password ||
    !new_passcode ||
    !confirm_passcode ||
    !hv_attempt_id ||
    typeof hv_answer !== "number"
  ) {
    return fail();
  }

  if (new_passcode !== confirm_passcode) {
    return fail();
  }

  // 🔒 PASSCODE RULE (LOCKED)
  // EXACTLY 8 chars — ANY charset allowed
  if (String(new_passcode).trim().length !== 8) {
    return fail();
  }

  // ---------------------------------------------------------------------------
  // Human verification (MANDATORY)
  // ---------------------------------------------------------------------------
  const hvOk = await humanVerification.validate(req, {
    attemptId: hv_attempt_id,
    answer: hv_answer,
    endpoint: "forgot_passcode",
  });
  console.log("[FPASSCODE][HV_RESULT]", hvOk);

  if (!hvOk) return fail();

  // ---------------------------------------------------------------------------
  // Service-role DB client (NO session persistence)
  // ---------------------------------------------------------------------------
  const db = createClient(
    SUPABASE_URL,
    SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  // ---------------------------------------------------------------------------
  // Atomic DB RPC (SSOT)
  // ---------------------------------------------------------------------------
  console.log("[FPASSCODE][RPC_CALL]", {
  identifier: String(identifier).trim().toLowerCase(),
  passwordLen: String(password).length,
  newPasscodeLen: String(new_passcode).length,
});
  const { data, error } = await db.rpc("forgot_passcode_complete", {
     p_identifier: String(identifier).trim().toLowerCase(),
    p_password: String(password),
    p_new_passcode: String(new_passcode),
    p_identifier_hash: `forgot_passcode:${String(identifier).trim()}`,
    p_secondary_identifier_hash: null,
    p_request_id: req.headers.get("X-Request-Id") ?? null,
  });
   console.log("[FPASSCODE][RPC_RESULT]", {
  error,
  data,
  dataOk: data?.ok,
});

  if (error || !data || data.ok !== true) {
    console.warn("[FPASSCODE][FAIL_REASON]", {
  hasError: !!error,
  error,
  hasData: !!data,
  dataOk: data?.ok,
});
    return fail();
  }

  // ---------------------------------------------------------------------------
  // Success
  // ---------------------------------------------------------------------------
  return apiResponse({
    status: "OK",
    code: "FORGOT_PASSCODE_COMPLETED",
    message: "Passcode updated successfully. Please login.",
    action: Action.GO_TO_LOGIN,
  });
}

// -----------------------------------------------------------------------------
// Enumeration-safe failure (NO INFO LEAK)
// -----------------------------------------------------------------------------
function fail(): Response {
  return apiResponse(
    {
      status: "ERROR",
      code: "FORGOT_PASSCODE_FAILED",
      message: "Unable to process request. Please try again.",
      action: Action.NONE,
    },
    400
  );
}
