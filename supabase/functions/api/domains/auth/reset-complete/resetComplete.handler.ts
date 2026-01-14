// ============================================================================
// PACE-ERP :: AUTH DOMAIN
// Gate  : 4.5B
// File  : resetComplete.handler.ts
// Purpose: Complete admin-approved reset (password + passcode)
// Status : FINAL – PRODUCTION READY
//
// RULES (LOCKED):
// - Public endpoint
// - Human verification mandatory
// - RESET_REQUIRED only
// - Backend = orchestration only
// - DB RPC = single source of truth
// ============================================================================

import { apiResponse, Action } from "../../../utils/response.ts";
import { humanVerification } from "../../../utils/humanVerification/index.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
export async function resetCompleteHandler(req: Request): Promise<Response> {
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
  // Validation (enumeration safe)
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

  if (String(new_password).length < 8) {
    return fail();
  }

  if (String(new_passcode).length !== 8) {
    return fail();
  }

  const normalizedPhone = String(phone).trim();
  const identifier = `${normalizedPhone}@pace.in`;

  // ---------------------------------------------------------------------------
  // Human verification
  // ---------------------------------------------------------------------------
  const hvOk = await humanVerification.validate(req, {
    attemptId: hv_attempt_id,
    answer: hv_answer,
    endpoint: "reset_complete",
  });

  if (!hvOk) return fail();

  // ---------------------------------------------------------------------------
  // DB client (service role)
  // ---------------------------------------------------------------------------
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // ---------------------------------------------------------------------------
  // RPC call (SSOT)
  // ---------------------------------------------------------------------------
  const { data, error } = await db.rpc("reset_complete", {
    p_phone: normalizedPhone,
    p_new_passcode: new_passcode,
    p_new_password: new_password,
    p_identifier_hash: `reset_complete:${identifier}`,
    p_request_id: req.headers.get("X-Request-Id") ?? null,
  });

  if (error) return fail();

  const ok =
    Array.isArray(data) &&
    data.length === 1 &&
    data[0]?.ok === true;

  if (!ok) return fail();

  // ---------------------------------------------------------------------------
  // Success
  // ---------------------------------------------------------------------------
  return apiResponse({
    status: "OK",
    code: "RESET_COMPLETED",
    message: "Password reset complete. Please login.",
    action: Action.GO_TO_LOGIN,
  });
}

// -----------------------------------------------------------------------------
// Failure (enumeration safe)
// -----------------------------------------------------------------------------
function fail(): Response {
  return apiResponse(
    {
      status: "ERROR",
      code: "RESET_FAILED",
      message: "Unable to complete reset. Please try again.",
      action: Action.NONE,
    },
    400
  );
}
