// ============================================================================
// PACE-ERP :: AUTH DOMAIN
// Gate  : 2 (AUTH)
// ID    : 2.1 (Login API Orchestrator)
// File  : login.handler.ts
// Role  : Orchestrate login flow (2.1A -> 2.1B -> 2.1C)
// Status: ACTIVE (Gate-2 In Progress)
// ----------------------------------------------------------------------------
// SSOT RULE:
// - This file orchestrates ONLY (no business logic)
// - All failures map to generic AUTH_LOGIN_FAILED externally
// - No cookies here (ID-2.2)
// - No roles / context / ACL
// ============================================================================

import { LOGIN_PUBLIC_CODE } from "./login.types.ts";
import { checkCredentials } from "./credential.check.ts";
import { checkAccountState } from "./account.state.ts";
import { createSession } from "./session.create.ts";
import { logAuthEvent } from "../../../utils/authAudit.ts";

import {
  revokeOtherSessions,
  getLastSessionDeviceTag,
} from "./_internals/auth.db.ts";

import { generateDeviceTag } from "./_internals/device.tag.ts";

// ⬇️ Supabase client (password verification only)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!
);

export async function loginHandler(
  req: Request,
  ctx: { respond: Function }
) {
  // ─────────────────────────────────────────
  // ENV sanity check (debug only)
  // ─────────────────────────────────────────
  console.log("ENV_CHECK", {
    SUPABASE_URL: !!Deno.env.get("SUPABASE_URL"),
    SUPABASE_ANON_KEY: !!Deno.env.get("SUPABASE_ANON_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  });

  try {
    // ─────────────────────────────────────────
    // Parse request body
    // ─────────────────────────────────────────
    let body: any;
    try {
      body = await req.json();
    } catch {
      return ctx.respond(
        { ok: false, code: LOGIN_PUBLIC_CODE.FAILED, action: "NONE" },
        401
      );
    }

    const { identifier, password } = body || {};
    if (!identifier || !password) {
      return ctx.respond(
        { ok: false, code: LOGIN_PUBLIC_CODE.FAILED, action: "NONE" },
        401
      );
    }

    // ─────────────────────────────────────────
    // STEP-0: Supabase password verification
    // ─────────────────────────────────────────
    const email = String(identifier).includes("@")
      ? String(identifier).trim().toLowerCase()
      : `${String(identifier).trim().toLowerCase()}@pace.in`;

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    console.log("[LOGIN] SUPABASE_AUTH_RESULT", {
      hasUser: !!authData?.user,
      error: authError?.message ?? null,
    });

    if (authError || !authData?.user) {
      await logAuthEvent({
        eventType: "LOGIN_FAILED",
        identifier,
        result: "FAILED",
      });

      return ctx.respond(
        { ok: false, code: LOGIN_PUBLIC_CODE.FAILED, action: "NONE" },
        401
      );
    }

    // ─────────────────────────────────────────
    // ID-2.1A: ERP credential check
    // ─────────────────────────────────────────
    const credResult = await checkCredentials({ identifier });
    console.log("[LOGIN] CRED_RESULT", credResult);

    if (!credResult.ok) {
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

    const user = credResult.data;

    // ─────────────────────────────────────────
    // ID-2.1B: Account state check
    // ─────────────────────────────────────────
    const stateResult = checkAccountState(
      user as { account_state?: string }
    );
    console.log("[LOGIN] STATE_RESULT", stateResult);

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
    // Gate-3.5A :: Device Change Signal (SOFT)
    // ─────────────────────────────────────────
    const currentDeviceTag = generateDeviceTag(req);
    const lastDeviceTag = await getLastSessionDeviceTag(user.id);

    if (lastDeviceTag && lastDeviceTag !== currentDeviceTag) {
      console.warn("[Gate-3.5A] DEVICE_CHANGED", {
        userId: user.id,
        lastDeviceTag,
        currentDeviceTag,
      });

      await logAuthEvent({
        eventType: "DEVICE_CHANGED",
        identifier,
        result: "SOFT_SIGNAL",
        requestId: req.headers.get("X-Request-Id") ?? undefined,
      });
    }

    // ─────────────────────────────────────────
    // ID-2.1C: Session creation (Gate-3.5 device tag inside)
    // ─────────────────────────────────────────
    const sessionResult = await createSession(
      user as { id: string },
      req
    );

    if (!sessionResult.ok) {
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
    // Gate-3.3: Single Active Session Enforcement
    // ─────────────────────────────────────────
    await revokeOtherSessions(
      user.id,
      sessionResult.data.session_id
    );

    console.log("[LOGIN] SESSION_RESULT", sessionResult);

    // ─────────────────────────────────────────
    // 🔐 AUDIT: login success
    // ─────────────────────────────────────────
    await logAuthEvent({
      eventType: "LOGIN_SUCCESS",
      identifier,
      result: "OK",
      requestId: req.headers.get("X-Request-Id") ?? undefined,
    });

    // ─────────────────────────────────────────
    // SUCCESS RESPONSE (cookie handled elsewhere)
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
          ttl: 60 * 60 * 8, // 8 hours
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
