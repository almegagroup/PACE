// ============================================================================
// PACE-ERP :: AUTH DOMAIN
// Gate  : 4.5
// ID    : 4.5A (Reset Request - Public)
// File  : resetRequest.handler.ts
// Status: FINAL – PRODUCTION READY
//
// RULES (LOCKED):
// - Public endpoint
// - Human verification mandatory
// - Enumeration-safe response (no user existence leak)
// - DB = Single Source of Truth (via SECURITY DEFINER RPC)
// - No direct table access (secure schema never touched here)
// - Best-effort audit; never blocks flow
// ============================================================================

import { apiResponse, Action } from "../../../utils/response.ts";
import { humanVerification } from "../../../utils/humanVerification/index.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAuthEvent } from "../../../utils/authAudit.ts";

// ---------------------------------------------------------------------------
// ENV (Edge-safe naming strongly recommended)
// ---------------------------------------------------------------------------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("[RESET_REQUEST][ENV_MISSING]");
  throw new Error("SUPABASE_ENV_MISSING");
}

// ---------------------------------------------------------------------------
// Enumeration-safe responses
// ---------------------------------------------------------------------------
function okWait(): Response {
  return apiResponse(
    {
      status: "OK",
      code: "RESET_REQUEST_RECEIVED",
      message:
        "If your account exists, it has been secured and the request is under review.",
      action: Action.WAIT_FOR_ACCESS,
    },
    200,
    { route: "/auth/reset-request" }
  );
}

function fail(): Response {
  return apiResponse(
    {
      status: "ERROR",
      code: "RESET_REQUEST_FAILED",
      message: "Unable to submit request. Please try again.",
      action: Action.NONE,
    },
    400,
    { route: "/auth/reset-request" }
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function canonicalizeIdentifier(raw: string): string {
  const v = String(raw).trim().toLowerCase();
  return v.includes("@") ? v : `${v}@pace.in`;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export async function resetRequestHandler(req: Request): Promise<Response> {
  const body = (req as any)._body ?? null;
  if (!body) return fail();

  const { identifier, hv_attempt_id, hv_answer } = body;

  if (
    !identifier ||
    typeof identifier !== "string" ||
    !hv_attempt_id ||
    typeof hv_attempt_id !== "string" ||
    typeof hv_answer !== "number"
  ) {
    return fail();
  }

  // -------------------------------------------------------------------------
  // 1️⃣ Human verification (MANDATORY)
  // -------------------------------------------------------------------------
  const hvOk = await humanVerification.validate(req, {
    attemptId: hv_attempt_id,
    answer: hv_answer,
    endpoint: "reset_request",
  });

  if (!hvOk) return fail();

  const canonicalId = canonicalizeIdentifier(identifier);

  // -------------------------------------------------------------------------
  // 2️⃣ Service-role DB client (no session persistence)
  // -------------------------------------------------------------------------
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  // -------------------------------------------------------------------------
  // 3️⃣ Single SSOT call (DB handles everything)
  // -------------------------------------------------------------------------
  try {
    await db.rpc("request_auth_reset", {
      p_identifier: canonicalId,
    });
  } catch (e) {
    // Enumeration-safe: never leak DB failure details
    console.error("[RESET_REQUEST][RPC_CALL_FAILED]", e);
  }

  // -------------------------------------------------------------------------
  // 4️⃣ Best-effort audit (never blocks)
  // -------------------------------------------------------------------------
  try {
    await logAuthEvent({
      eventType: "RESET_REQUEST_CREATED",
      identifier: canonicalId,
      result: "OK",
      requestId: req.headers.get("X-Request-Id") ?? null,
    });
  } catch {
    // silent by design
  }

  // -------------------------------------------------------------------------
  // 5️⃣ Enumeration-safe success (ALWAYS same)
  // -------------------------------------------------------------------------
  return okWait();
}
