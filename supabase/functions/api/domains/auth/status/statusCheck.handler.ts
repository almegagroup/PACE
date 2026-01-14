// ============================================================================
// PACE-ERP :: AUTH DOMAIN
// Gate  : 4 (Overlay)
// ID    : 4.3 (Status Check Entry Gate)
// File  : statusCheck.handler.ts
// Role  : Public status check for onboarding + recovery lifecycle
// ----------------------------------------------------------------------------
// SSOT RULES (UPDATED):
// - USER TABLE WINS if user already exists
// - Signup table used ONLY if user does not exist
// - Enumeration-safe: always returns 200
// - No session, no ACL, no credential checks
// ============================================================================

import { apiResponse } from "../../../utils/response.ts";
import { logAuthEvent } from "../../../utils/authAudit.ts";
import { getPublicDb } from "../login/_internals/auth.db.ts";

type StatusAction = "WAIT" | "STOP" | "FIRST_LOGIN" | "GO_TO_LOGIN";

function buildOk(code: string, message: string, action: StatusAction) {
  return apiResponse(
    {
      status: "OK",
      code,
      message,
      action,
    },
    200,
    { route: "/auth/status-check" }
  );
}

export async function statusCheckHandler(req: Request): Promise<Response> {
  const body = (req as any)._body ?? null;
  const raw = body?.identifier;

  // ---------------------------------------------------------------------------
  // Enumeration-safe default
  // ---------------------------------------------------------------------------
  if (!raw || typeof raw !== "string") {
    await logAuthEvent({
      eventType: "STATUS_CHECK",
      identifier: null,
      result: "OK",
      requestId: req.headers.get("X-Request-Id") ?? null,
    });

    return buildOk(
      "STATUS_UNKNOWN",
      "If your request exists, you will be notified.",
      "WAIT"
    );
  }

  const value = raw.trim().toLowerCase();
  const db = getPublicDb();

  // ===========================================================================
  // STEP 1️⃣ : USER EXISTS? → USER TABLE DECIDES (Credential lifecycle)
  // ===========================================================================
  const canonicalId = value.includes("@")
    ? value
    : `${value}@pace.in`;

  const { data: user } = await db
    .from("auth_users")
    .select("state")
    .eq("identifier", canonicalId)
    .maybeSingle();

  if (user) {
    await logAuthEvent({
      eventType: "STATUS_CHECK",
      identifier: value,
      result: "OK",
      requestId: req.headers.get("X-Request-Id") ?? null,
    });

    switch (user.state) {
      case "FIRST_LOGIN_REQUIRED":
      case "RESET_REQUIRED":
        return buildOk(
          "STATUS_FIRST_LOGIN_REQUIRED",
          "First login setup required.",
          "FIRST_LOGIN"
        );

      case "ACTIVE":
        return buildOk(
          "STATUS_COMPLETED",
          "Account setup complete. Please login.",
          "GO_TO_LOGIN"
        );

      case "LOCKED":
      case "DISABLED":
        return buildOk(
          "STATUS_BLOCKED",
          "Account is not active.",
          "STOP"
        );

      default:
        // Safety net for future enum additions
        return buildOk(
          "STATUS_UNKNOWN",
          "If your request exists, you will be notified.",
          "WAIT"
        );
    }
  }

  // ===========================================================================
  // STEP 2️⃣ : USER DOES NOT EXIST → SIGNUP LIFECYCLE (fallback only)
  // ===========================================================================
  const { data, error } = await db
    .from("auth_signup_requests")
    .select("state")
    .or(`phone.eq.${value},email.eq.${value}`)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await logAuthEvent({
    eventType: "STATUS_CHECK",
    identifier: value,
    result: "OK",
    requestId: req.headers.get("X-Request-Id") ?? null,
  });

  const state = !error ? data?.state : undefined;

  switch (state) {
    case "REQUESTED":
      return buildOk(
        "STATUS_PENDING",
        "Your request is under review.",
        "WAIT"
      );

    case "REJECTED":
      return buildOk(
        "STATUS_REJECTED",
        "Your request was rejected.",
        "STOP"
      );

    case "SET_FIRST_LOGIN":
      return buildOk(
        "STATUS_FIRST_LOGIN_REQUIRED",
        "First login setup pending.",
        "FIRST_LOGIN"
      );

    case "CONSUMED":
      return buildOk(
        "STATUS_COMPLETED",
        "Account setup complete. Please login.",
        "GO_TO_LOGIN"
      );

    default:
      return buildOk(
        "STATUS_UNKNOWN",
        "If your request exists, you will be notified.",
        "WAIT"
      );
  }
}
