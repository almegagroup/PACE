// ============================================================================
// PACE-ERP :: AUTH DOMAIN
// Gate  : 4
// ID    : 4.3B (First Login Completion)
// File  : firstLogin.handler.ts
// Status: FINAL – PLUG & PLAY
//
// RULES (LOCKED):
// - Public endpoint
// - Human verification mandatory
// - NO old passcode verification
// - Backend = orchestration only
// - DB RPC = single source of truth
// ============================================================================

import { apiResponse, Action } from "../../../utils/response.ts";
import { humanVerification } from "../../../utils/humanVerification/index.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// -----------------------------------------------------------------------------
// ENV (MANDATORY)
// -----------------------------------------------------------------------------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_ENV_MISSING");
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------
export async function firstLoginHandler(req: Request): Promise<Response> {
  const body = (req as any)._body;
  if (!body) return fail();

  const {
    phone,
    new_passcode,
    new_password,
    confirm_password,
    hv_attempt_id,
    hv_answer,
  } = body;

  // ---------------------------------------------------------------------------
  // Basic validation (enumeration-safe)
  // ---------------------------------------------------------------------------
  if (
    !phone ||
    !new_passcode ||
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

  // Minimum backend guard (complex rules FE-তে)
  if (String(new_password).length < 8) {
    return fail();
  }

  if (String(new_passcode).length !== 8) {
    return fail();
  }

  // Normalize phone once (single source for this request)
  const normalizedPhone = String(phone).trim();

  // ---------------------------------------------------------------------------
  // Human verification (MANDATORY)
  // ---------------------------------------------------------------------------
  const hvOk = await humanVerification.validate(req, {
    attemptId: hv_attempt_id,
    answer: hv_answer,
    endpoint: "first_login",
  });

  if (!hvOk) return fail();

  // ---------------------------------------------------------------------------
  // Service-role DB client (no session persistence)
  // ---------------------------------------------------------------------------
  const db = createClient(
    SUPABASE_URL,
    SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  // ---------------------------------------------------------------------------
  // Build audit identifier hash (simple but traceable)
  // ---------------------------------------------------------------------------
  const identifierHash = `first_login:${normalizedPhone}`;

  // ---------------------------------------------------------------------------
  // Single DB call (ATOMIC, DB handles everything)
  // ---------------------------------------------------------------------------
  const { data, error } = await db.rpc("first_login_complete", {
    p_phone: normalizedPhone,
    p_new_passcode: new_passcode,
    p_new_password: new_password,
    p_identifier_hash: identifierHash,
    p_secondary_identifier_hash: null,
    p_request_id: req.headers.get("X-Request-Id") ?? null,
  });

  if (error || !data || data.ok !== true) {
    return fail();
  }

  // ---------------------------------------------------------------------------
  // Success
  // ---------------------------------------------------------------------------
  return apiResponse({
    status: "OK",
    code: "FIRST_LOGIN_COMPLETED",
    message: "Account setup complete. Please login.",
    action: Action.GO_TO_LOGIN,
  });
}

// -----------------------------------------------------------------------------
// Enumeration-safe failure (NO information leak)
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
