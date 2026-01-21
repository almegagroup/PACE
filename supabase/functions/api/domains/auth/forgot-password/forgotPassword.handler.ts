// ============================================================================
// PACE-ERP :: AUTH DOMAIN
// Gate  : 4
// ID    : 4.4 (Forgot Password)
// File  : forgotPassword.handler.ts
// Status: FINAL – PLUG & PLAY
//
// RULES:
// - Public endpoint
// - Human verification mandatory
// - User provides IDENTIFIER + PASSCODE
// - Backend = orchestration only
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
export async function forgotPasswordHandler(req: Request): Promise<Response> {
  const body = (req as any)._body ?? null;

  const {
    identifier,
    passcode,
    new_password,
    confirm_password,
    hv_attempt_id,
    hv_answer,
  } = body ?? {};
  console.log("[FPASS][REQ_BODY]", {
  identifier,
  passcodeLen: typeof passcode === "string" ? passcode.length : null,
  newPasswordLen: typeof new_password === "string" ? new_password.length : null,
  confirmMatch: new_password === confirm_password,
  hv_attempt_id,
  hv_answer,
});

  // ---------------------------------------------------------------------------
  // Basic validation (enumeration-safe)
  // ---------------------------------------------------------------------------
  if (
    !identifier ||
    !passcode ||
    !new_password ||
    !confirm_password ||
    !hv_attempt_id ||
    typeof hv_answer !== "number"
  ) {
    return fail();
  }

  if (new_password !== confirm_password) {
    return fail();
  }

  if (String(passcode).length !== 8) {
    return fail();
  }

  // ---------------------------------------------------------------------------
  // Human verification (MANDATORY)
  // ---------------------------------------------------------------------------
  const hvOk = await humanVerification.validate(req, {
    attemptId: hv_attempt_id,
    answer: hv_answer,
    endpoint: "forgot_password",
  });
  console.log("[FPASS][HV_RESULT]", hvOk);

  if (!hvOk) return fail();

  // ---------------------------------------------------------------------------
  // Service-role DB client
  // ---------------------------------------------------------------------------
  const db = createClient(
    SUPABASE_URL,
    SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  // ---------------------------------------------------------------------------
  // Atomic DB RPC (SSOT)
  // ---------------------------------------------------------------------------
  console.log("[FPASS][RPC_CALL]", {
  identifier: String(identifier).trim().toLowerCase(),
  passcodeLen: String(passcode).length,
  newPasswordLen: String(new_password).length,
});

  const { data, error } = await db.rpc("forgot_password_complete", {
    p_identifier: String(identifier).trim().toLowerCase(),
    p_passcode: passcode,
    p_new_password: new_password,
    p_identifier_hash: `forgot_password:${identifier}`,
    p_secondary_identifier_hash: null,
    p_request_id: req.headers.get("X-Request-Id") ?? null,
  });
  console.log("[FPASS][RPC_RESULT]", {
  error,
  data,
  dataOk: data?.ok,
});


  if (error || !data || data.ok !== true) {
    console.warn("[FPASS][FAIL_REASON]", {
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
    code: "FORGOT_PASSWORD_COMPLETED",
    message: "Password updated successfully. Please login.",
    action: Action.GO_TO_LOGIN,
  });
}

// -----------------------------------------------------------------------------
// Enumeration-safe failure
// -----------------------------------------------------------------------------
function fail(): Response {
  return apiResponse(
    {
      status: "ERROR",
      code: "FORGOT_PASSWORD_FAILED",
      message: "Unable to process request. Please try again.",
      action: Action.NONE,
    },
    400
  );
}
