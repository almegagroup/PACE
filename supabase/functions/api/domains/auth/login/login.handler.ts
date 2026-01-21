// ============================================================================
// PACE-ERP :: AUTH DOMAIN
// Gate  : 2 (AUTH) + Gate-4.3 Overlay
// ID    : 2.1 (Login API Orchestrator)
// File  : login.handler.ts
// Role  : Orchestrate login flow (2.1A -> 2.1B -> 2.1C)
// Status: FINAL (Gate-4.3 READY)
// ----------------------------------------------------------------------------
// SSOT RULE:
// - Orchestrator ONLY (no business logic)
// - Password verified against secure.auth_users
// - Gate-4.3 / 4.3A enforced HERE (early return)
// - SA / GA ALWAYS bypass ACL
// - No cookies here (ID-2.2)
// ============================================================================

import { LOGIN_PUBLIC_CODE } from "./login.types.ts";
import { checkAccountState } from "./account.state.ts";
import { createSession } from "./session.create.ts";
import { logAuthEvent } from "../../../utils/authAudit.ts";

import {
  revokeOtherSessions,
  getLastSessionDeviceTag,
} from "./_internals/auth.db.ts";

import { generateDeviceTag } from "./_internals/device.tag.ts";
import { verifyPassword } from "./_internals/auth.password.ts";
import { getServiceDb } from "./_internals/auth.db.ts";

export async function loginHandler(
  req: Request,
  ctx: { respond: Function }
) {
  try {
    // ─────────────────────────────────────────
    // 1️⃣ Parse request body (SSOT)
    // ─────────────────────────────────────────
    const body = (req as any)._body;

    if (!body) {
      return ctx.respond(
        { ok: false, code: LOGIN_PUBLIC_CODE.FAILED, action: "NONE" },
        401
      );
    }

    const { identifier, password } = body;
    if (!identifier || !password) {
      return ctx.respond(
        { ok: false, code: LOGIN_PUBLIC_CODE.FAILED, action: "NONE" },
        401
      );
    }

    // ─────────────────────────────────────────
    // 2️⃣ Canonical identifier
    // ─────────────────────────────────────────
    const canonicalId = String(identifier)
      .trim()
      .toLowerCase()
      .includes("@")
      ? String(identifier).trim().toLowerCase()
      : `${String(identifier).trim().toLowerCase()}@pace.in`;

    // ─────────────────────────────────────────
    // 3️⃣ Load user identity
    // ─────────────────────────────────────────
    const db = getServiceDb();

    const { data: user, error } = await db
      .from("auth_users")
      .select("id, state, is_sa, is_ga, acl_assigned")
      .eq("identifier", canonicalId)
      .single();

    if (error || !user) {
      await logAuthEvent({
        eventType: "LOGIN_FAILED",
        identifier,
        result: "FAILED",
        requestId: req.headers.get("X-Request-Id") ?? undefined,
      });

      return ctx.respond(
        { ok: false, code: LOGIN_PUBLIC_CODE.FAILED, action: "NONE" },
        401
      );
    }

    // ─────────────────────────────────────────
    // 4️⃣ Password verification
    // ─────────────────────────────────────────
    const passwordOk = await verifyPassword(user.id, password);

    if (!passwordOk) {
      await logAuthEvent({
        eventType: "LOGIN_FAILED",
        identifier,
        result: "FAILED",
        requestId: req.headers.get("X-Request-Id") ?? undefined,
      });

      return ctx.respond(
        { ok: false, code: LOGIN_PUBLIC_CODE.FAILED, action: "NONE" },
        401
      );
    }

    // ─────────────────────────────────────────
    // 🔑 Load credential lifecycle (Gate-4)
    // ─────────────────────────────────────────
    const { data: creds } = await db
      .from("auth_credentials")
      .select("force_first_login")
      .eq("user_id", user.id)
      .single();

    // ─────────────────────────────────────────
    // 5️⃣ Account state check (ID-2.1B)
    // ─────────────────────────────────────────
    const stateResult = checkAccountState({
      account_state: user.state,
    });

    if (!stateResult.ok) {
      await logAuthEvent({
        eventType: "LOGIN_FAILED",
        identifier,
        result: "FAILED",
        requestId: req.headers.get("X-Request-Id") ?? undefined,
      });

      return ctx.respond(
        { ok: false, code: LOGIN_PUBLIC_CODE.FAILED, action: "NONE" },
        401
      );
    }

    // ─────────────────────────────────────────
    // 🔐 Gate-4.3 / 4.3A / Option-B Enforcement
    // ─────────────────────────────────────────

    // 1️⃣ SA / GA bypass ALL first-login & ACL gates
    if (!(user.is_sa || user.is_ga)) {
      // 2️⃣ First login pending → allow login BUT force FIRST_LOGIN screen
      if (creds?.force_first_login === true) {
        await logAuthEvent({
          eventType: "FIRST_LOGIN_REQUIRED",
          identifier,
          result: "OK",
          requestId: req.headers.get("X-Request-Id") ?? undefined,
        });

        return ctx.respond(
          {
            status: "OK",
            code: LOGIN_PUBLIC_CODE.SUCCESS,
            message: "First login required",
            action: "FIRST_LOGIN",
          },
          200
        );
      }

      // 3️⃣ ACL not assigned → HARD BLOCK (WAIT FOR ACCESS)
      if (user.acl_assigned !== true) {
        await logAuthEvent({
          eventType: "LOGIN_BLOCKED_ACL",
          identifier,
          result: "BLOCKED",
          requestId: req.headers.get("X-Request-Id") ?? undefined,
        });

        return ctx.respond(
          {
            ok: false,
            code: LOGIN_PUBLIC_CODE.FAILED,
            action: "WAIT_FOR_ACCESS",
          },
          403
        );
      }
    }

    // ─────────────────────────────────────────
    // 6️⃣ Device change signal (Gate-3.5A)
    // ─────────────────────────────────────────
    const currentDeviceTag = generateDeviceTag(req);
    const lastDeviceTag = await getLastSessionDeviceTag(user.id);

    if (lastDeviceTag && lastDeviceTag !== currentDeviceTag) {
      await logAuthEvent({
        eventType: "DEVICE_CHANGED",
        identifier,
        result: "OK",
        requestId: req.headers.get("X-Request-Id") ?? undefined,
      });
    }

    // ─────────────────────────────────────────
    // 7️⃣ Session creation (ID-2.1C)
    // ─────────────────────────────────────────
    const sessionResult = await createSession({ id: user.id }, req);

if (!sessionResult.ok || !sessionResult.data) {
  await logAuthEvent({
    eventType: "LOGIN_FAILED",
    identifier,
    result: "FAILED",
    requestId: req.headers.get("X-Request-Id") ?? undefined,
  });

  return ctx.respond(
    { ok: false, code: LOGIN_PUBLIC_CODE.FAILED, action: "NONE" },
    401
  );
}

    // ─────────────────────────────────────────
    // 8️⃣ Single active session enforcement
    // ─────────────────────────────────────────
    await revokeOtherSessions(
      user.id,
      sessionResult.data.session_id
    );

    // ─────────────────────────────────────────
    // 9️⃣ Audit success
    // ─────────────────────────────────────────
    await logAuthEvent({
      eventType: "LOGIN_SUCCESS",
      identifier,
      result: "OK",
      requestId: req.headers.get("X-Request-Id") ?? undefined,
    });

    // ─────────────────────────────────────────
    // 🔚 Success response
    // ─────────────────────────────────────────
    return ctx.respond(
      {
        status: "OK",
        code: LOGIN_PUBLIC_CODE.SUCCESS,
        message: "Login successful",
        action: "NONE",
      },
      200,
      {
        route: "/auth/login",
        session: {
          id: sessionResult.data.session_id,
          ttl: 60 * 60 * 8,
        },
      }
    );
  } catch (err) {
    console.error("[LOGIN] UNHANDLED_EXCEPTION", err);

    return ctx.respond(
      { ok: false, code: LOGIN_PUBLIC_CODE.FAILED, action: "NONE" },
      401
    );
  }
}
