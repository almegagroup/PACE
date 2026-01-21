// ============================================================================
// PACE-ERP :: AUTH DOMAIN
// Gate  : 4
// ID    : 4.3B (First Login Completion)
// File  : firstLogin.handler.ts
// Status: FINAL – CANONICAL – NEVER TOUCH AGAIN
// ============================================================================

import { apiResponse, Action } from "../../../utils/response.ts";
import { humanVerification } from "../../../utils/humanVerification/index.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

// -----------------------------------------------------------------------------
// ENV (MANDATORY)
// -----------------------------------------------------------------------------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_ENV_MISSING");
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------
export async function firstLoginHandler(req: Request): Promise<Response> {
  console.log("[FIRST_LOGIN] handler entered");

  const body = (req as any)._body;
  if (!body) {
    console.log("[FIRST_LOGIN][FAIL] request body missing");
    return fail();
  }

  const {
    phone,
    new_passcode,
    new_password,
    confirm_password,
    hv_attempt_id,
    hv_answer,
  } = body;

  // ---------------------------------------------------------------------------
  // Basic validation (NO ENUMERATION LEAK)
  // ---------------------------------------------------------------------------
  if (
    !phone ||
    !new_passcode ||
    !new_password ||
    !confirm_password ||
    !hv_attempt_id ||
    typeof hv_answer !== "number"
  ) {
    console.log("[FIRST_LOGIN][FAIL] basic validation failed");
    return fail();
  }

  if (new_password !== confirm_password) {
    console.log("[FIRST_LOGIN][FAIL] password mismatch");
    return fail();
  }

  if (String(new_password).length < 8) {
    console.log("[FIRST_LOGIN][FAIL] password too short");
    return fail();
  }

  if (String(new_passcode).length !== 8) {
    console.log("[FIRST_LOGIN][FAIL] passcode length invalid");
    return fail();
  }

  const normalizedPhone = String(phone).trim();
  console.log("[FIRST_LOGIN] normalized phone:", normalizedPhone);

  // ---------------------------------------------------------------------------
  // Human verification (MANDATORY GATE)
  // ---------------------------------------------------------------------------
  const hvOk = await humanVerification.validate(req, {
    attemptId: hv_attempt_id,
    answer: hv_answer,
    endpoint: "signup",
  });

  if (!hvOk) {
    console.log("[FIRST_LOGIN][FAIL] human verification failed");
    return fail();
  }

  // ---------------------------------------------------------------------------
  // DB client (SERVICE ROLE, STATELESS)
  // ---------------------------------------------------------------------------
  const db = createClient(
    SUPABASE_URL,
    SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  // ---------------------------------------------------------------------------
  // SINGLE SOURCE OF TRUTH:
  // DB resolves user, validates signup, rotates credentials, activates user
  // ---------------------------------------------------------------------------
  console.log("[FIRST_LOGIN] invoking canonical DB RPC");

  const { data, error } = await db.rpc("first_login_complete", {
    p_phone: normalizedPhone,
    p_new_passcode: new_passcode,
    p_new_password: new_password,
    p_identifier_hash: null,
    p_secondary_identifier_hash: null,
    p_request_id: req.headers.get("X-Request-Id"),
  });

  if (error || !data || data.ok !== true) {
    console.log("[FIRST_LOGIN][FAIL] DB rejected first login", {
      data,
      error,
    });
    return fail();
  }

  // ---------------------------------------------------------------------------
  // SUCCESS
  // ---------------------------------------------------------------------------
  console.log("[FIRST_LOGIN][SUCCESS] first login completed");

  return apiResponse({
    status: "OK",
    code: "FIRST_LOGIN_COMPLETED",
    message: "Account setup complete. Please login.",
    action: Action.NONE,
  });
}

// -----------------------------------------------------------------------------
// Enumeration-safe failure (NO INFORMATION LEAK)
// -----------------------------------------------------------------------------
function fail(): Response {
  return apiResponse(
    {
      status: "ERROR",
      code: "FIRST_LOGIN_FAILED",
      message: "Unable to complete setup. Please try again.",
      action: Action.NONE,
    },
    400
  );
}
