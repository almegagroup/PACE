// ==================================================
// Gate-4 | ID-4.1
// Domain : AUTH
// Module : Signup Request
// Purpose: Controlled signup intent (NO user creation)
// Status : FREEZE-ALIGNED
// ==================================================
//
// SSOT Table:
//   auth_signup_requests
//
// Invariants:
// - NO auth.users insert
// - NO password handling
// - NO session creation
// - ALWAYS generic response (ID-4.1A)
// - Rate limited (ID-4.1B)
// ==================================================

import { apiResponse } from "../../../utils/response.ts";
import { logAuthEvent } from "../../../utils/authAudit.ts";
import { getServiceDb } from "../login/_internals/auth.db.ts";
import { verifyCaptcha } from "../../../utils/verifyCaptcha.ts";

export async function signupRequestHandler(req: Request): Promise<Response> {
  let payload: any = {};

  // ─────────────────────────────────────────
  // Safe body parse (silent)
  // ─────────────────────────────────────────
  try {
    payload = await req.json();
  } catch {
    // silent
  }

  const {
    name,
    email,
    phone,
    company_hint,
    department_hint,
    designation_hint,
    captchaToken,
  } = payload || {};

  // ─────────────────────────────────────────
  // Silent validation
  // ─────────────────────────────────────────
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^[0-9]{10}$/;

  const isValid =
    typeof name === "string" &&
    typeof email === "string" &&
    typeof phone === "string" &&
    typeof captchaToken === "string" &&
    emailRegex.test(email) &&
    phoneRegex.test(phone);

  if (!isValid) {
    return genericOk();
  }

  // ─────────────────────────────────────────
  // CAPTCHA verification (MANDATORY, silent)
  // ─────────────────────────────────────────
  let captchaOk = false;

  try {
    captchaOk = await verifyCaptcha(captchaToken);
  } catch {
    captchaOk = false;
  }

  if (!captchaOk) {
    return genericOk();
  }

  // ─────────────────────────────────────────
  // DB insert (intent only)
  // ─────────────────────────────────────────
  const db = getServiceDb();

  try {
    await db.from("auth_signup_requests").insert({
      name,
      email: email.toLowerCase(),
      phone,
      company_hint,
      department_hint,
      designation_hint,
      state: "REQUESTED",
    });
  } catch {
    // swallow — enumeration forbidden
  }

  // ─────────────────────────────────────────
  // Audit log (best-effort, non-sensitive)
  // ─────────────────────────────────────────
  try {
    await logAuthEvent({
      eventType: "SIGNUP_REQUEST",
      identifier: email.toLowerCase(),
      result: "RECEIVED",
      requestId: req.headers.get("X-Request-Id") ?? undefined,
    });
  } catch {
    // audit must never block response
  }

  return genericOk();
}

// ─────────────────────────────────────────
// Helper (single generic response authority)
// ─────────────────────────────────────────
function genericOk(): Response {
  return apiResponse({
    status: "OK",
    code: "SIGNUP_REQUEST_RECEIVED",
    message: "Request received",
    action: "NONE",
  });
}
