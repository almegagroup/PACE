/**
 * File-ID: ID-4.1 + ID-4.1A + ID-4.1C
 * Gate: 4
 * Phase: 4
 * Domain: AUTH / SECURITY
 * Tier: A
 * Status: FINAL – FROZEN
 *
 * PURPOSE
 * -------
 * Accept public signup intent and store REQUESTED record.
 *
 * HARD RULES (LOCKED)
 * ------------------
 * - NO user creation
 * - NO password handling
 * - NO session creation
 * - Backend-only human verification
 * - User MUST know success vs failure
 * - Reason MUST NOT be revealed
 * - Postman / Frontend / Prod behaviour identical
 */

import { apiResponse, Action } from "../../../utils/response.ts";
import { logAuthEvent } from "../../../utils/authAudit.ts";
import { getPublicDb } from "../login/_internals/auth.db.ts";
import { humanVerification } from "../../../utils/humanVerification/index.ts";

// ─────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────
export async function signupRequestHandler(
  req: Request
): Promise<Response> {
  const payload = (req as any)._body;

if (!payload) {
  return fail();
}


  // ─────────────────────────────────────────
  // Extract payload (FULL – nothing missing)
  // ─────────────────────────────────────────
  const {
    name,
    email,
    phone,
    company_hint,
    department_hint,
    designation_hint,
    hv_attempt_id,
    hv_answer,
  } = payload || {};

  // ─────────────────────────────────────────
  // Basic format validation (silent)
  // ─────────────────────────────────────────
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^[0-9]{10}$/;

  const formatOk =
    typeof name === "string" &&
    typeof email === "string" &&
    typeof phone === "string" &&
    emailRegex.test(email) &&
    phoneRegex.test(phone) &&
    typeof hv_attempt_id === "string" &&
    typeof hv_answer === "number";

  if (!formatOk) {
    return fail();
  }

  // ─────────────────────────────────────────
  // Human Verification (ID-4.1C)
  // Backend only – deterministic
  // ─────────────────────────────────────────
  const hvPassed = await humanVerification.validate(req, {
    attemptId: hv_attempt_id,
    answer: hv_answer,
    endpoint: "signup",
  });

  if (!hvPassed) {
    // User knows request failed, but NOT why
    return fail();
  }

  // ─────────────────────────────────────────
  // DB Insert (Intent Only)
  // ─────────────────────────────────────────
  try {
    const db = getPublicDb();
    await db.from("auth_signup_requests").insert({
      name,
      email: email.toLowerCase(),
      phone,
      company_hint: company_hint ?? null,
      department_hint: department_hint ?? null,
      designation_hint: designation_hint ?? null,
      state: "REQUESTED",
    });
  } catch {
    // Enumeration safe – DO NOT reveal
  }

  // ─────────────────────────────────────────
  // Audit (Best-effort, non-blocking)
  // ─────────────────────────────────────────
  try {
    await logAuthEvent({
      eventType: "SIGNUP_REQUEST",
      identifier: email.toLowerCase(),
      result: "OK",
      requestId: req.headers.get("X-Request-Id") ?? undefined,
    });
  } catch {
    // Never block response
  }

  return success();
}

// ─────────────────────────────────────────
// Response Authorities (FINAL)
// ─────────────────────────────────────────
function success(): Response {
  return apiResponse({
    status: "OK",
    code: "SIGNUP_REQUEST_ACCEPTED",
    message: "Request submitted",
    action: Action.NONE,
  });
}

function fail(): Response {
  return apiResponse(
    {
      status: "ERROR",
      code: "SIGNUP_REQUEST_FAILED",
      message: "Request could not be submitted. Please try again.",
      action: Action.NONE,
    },
    400
  );
}
