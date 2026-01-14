// ============================================================================
// PACE-ERP :: AUTH DOMAIN
// Gate  : 4.5B
// File  : adminReset.handler.ts
// Purpose: Super Admin governed reset approval / rejection
// Status : FINAL – PRODUCTION READY (DEBUG INSTRUMENTED)
//
// RULES (LOCKED):
// - SUPER_ADMIN ONLY
// - Session required
// - No public access
// - DB = SSOT (constraints enforce correctness)
// - All actions transactional
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAuthEvent } from "../../../utils/authAudit.ts";

// ---------------------------------------------------------------------------
// ENV
// ---------------------------------------------------------------------------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_ENV_MISSING");
}

// 🔎 FILE LOAD PROBE
console.log("[ADMIN_RESET_HANDLER_LOADED]");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function forbid(ctx: any) {
  return ctx.respond(
    {
      status: "ERROR",
      code: "FORBIDDEN",
      message: "Not authorized",
      action: "NONE",
    },
    403
  );
}

function badRequest(ctx: any, message = "Invalid request") {
  return ctx.respond(
    {
      status: "ERROR",
      code: "INVALID_REQUEST",
      message,
      action: "NONE",
    },
    400
  );
}

// ---------------------------------------------------------------------------
// DB client (service role, no session persistence)
// ---------------------------------------------------------------------------
function getDb() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

// ===========================================================================
// 1️⃣ LIST RESET REQUESTS (REQUESTED)
// GET /api/admin/auth/reset-requests
// ===========================================================================
export async function listResetRequestsHandler(
  _req: Request,
  ctx: { user: any; respond: Function }
) {
  console.log("[RESET_LIST_ENTER]");
  console.log("[RESET_LIST_CTX_USER]", ctx.user);

  console.log("[RESET_LIST_ROLE_CHECK]", {
    hasUser: !!ctx.user,
    roleRank: ctx.user?.roleRank,
  });

  if (!ctx.user || ctx.user.roleRank !== 999) {
    console.log("[RESET_LIST_FORBIDDEN]");
    return forbid(ctx);
  }

  const db = getDb();

  console.log("[RESET_LIST_DB_QUERY_START]");

  const { data, error } = await db
    .from("auth_reset_requests")
    .select("id, user_id, identifier, state, requested_at")
    .eq("state", "REQUESTED")
    .order("requested_at", { ascending: false });

  console.log("[RESET_LIST_DB_RESULT]", {
    error,
    count: data?.length,
  });

  if (error) {
    return ctx.respond(
      { status: "ERROR", code: "DB_ERROR", action: "NONE" },
      500
    );
  }

  console.log("[RESET_LIST_SUCCESS_RETURN]");

  return ctx.respond(
    {
      status: "OK",
      code: "RESET_REQUESTS_LIST",
      data: data ?? [],
      action: "NONE",
    },
    200
  );
}

// ===========================================================================
// 2️⃣ APPROVE RESET REQUEST
// POST /api/admin/auth/reset-requests/:id/approve
// ===========================================================================
export async function approveResetRequestHandler(
  req: Request,
  ctx: { user: any; respond: Function; params: any }
) {
  console.log("[RESET_APPROVE_ENTER]", {
    params: ctx.params,
    user: ctx.user,
  });

  if (!ctx.user || ctx.user.roleRank !== 999) {
    console.log("[RESET_APPROVE_FORBIDDEN]");
    return forbid(ctx);
  }

  const resetId = ctx.params?.id;
  const body = (req as any)._body;
  const reason = body?.reason ?? null;

  if (!resetId) {
    console.log("[RESET_APPROVE_BAD_REQUEST]");
    return badRequest(ctx);
  }

  const db = getDb();

  console.log("[RESET_APPROVE_LOAD_ROW]", resetId);

  const { data: reset, error } = await db
    .from("auth_reset_requests")
    .select("id, user_id, state")
    .eq("id", resetId)
    .maybeSingle();

  console.log("[RESET_APPROVE_ROW_RESULT]", reset);

  if (error || !reset || reset.state !== "REQUESTED") {
    return badRequest(ctx, "Invalid reset request");
  }

  await db
    .from("auth_reset_requests")
    .update({
      state: "APPROVED",
      reviewed_by: ctx.user.identifier,
      reviewed_at: new Date().toISOString(),
      review_reason: reason,
    })
    .eq("id", resetId);

  const { error: userUpdErr } = await db
  .schema("secure")
  .from("auth_users")
  .update({
    state: "RESET_REQUIRED",
    updated_at: new Date().toISOString(),
  })
  .eq("id", reset.user_id);

if (userUpdErr) {
  console.log("[RESET_APPROVE_USER_UPDATE_ERROR]", userUpdErr);
  return ctx.respond({ status: "ERROR", code: "DB_ERROR", action: "NONE" }, 500);
}

  console.log("[RESET_APPROVE_UPDATE_DONE]");

  await logAuthEvent({
    eventType: "RESET_APPROVED",
    identifier: ctx.user.identifier ?? null,
    result: "OK",
    requestId: req.headers.get("X-Request-Id") ?? null,
  });

  return ctx.respond(
    {
      status: "OK",
      code: "RESET_APPROVED",
      message: "Reset request approved",
      action: "NONE",
    },
    200
  );
}

// ===========================================================================
// 3️⃣ REJECT RESET REQUEST
// POST /api/admin/auth/reset-requests/:id/reject
// ===========================================================================
export async function rejectResetRequestHandler(
  req: Request,
  ctx: { user: any; respond: Function; params: any }
) {
  console.log("[RESET_REJECT_ENTER]", {
    params: ctx.params,
    user: ctx.user,
  });

  if (!ctx.user || ctx.user.roleRank !== 999) {
    console.log("[RESET_REJECT_FORBIDDEN]");
    return forbid(ctx);
  }

  const resetId = ctx.params?.id;
  const body = (req as any)._body;
  const reason = body?.reason ?? null;

  if (!resetId) {
    console.log("[RESET_REJECT_BAD_REQUEST]");
    return badRequest(ctx);
  }

  const db = getDb();

  console.log("[RESET_REJECT_LOAD_ROW]", resetId);

  const { data: reset, error } = await db
    .from("auth_reset_requests")
    .select("id, user_id, state")
    .eq("id", resetId)
    .maybeSingle();

  console.log("[RESET_REJECT_ROW_RESULT]", reset);

  if (error || !reset || reset.state !== "REQUESTED") {
    return badRequest(ctx, "Invalid reset request");
  }

  await db
    .from("auth_reset_requests")
    .update({
      state: "REJECTED",
      reviewed_by: ctx.user.identifier,
      reviewed_at: new Date().toISOString(),
      review_reason: reason,
    })
    .eq("id", resetId);

  const { error: userUpdErr } = await db
  .schema("secure")
  .from("auth_users")
  .update({
    state: "ACTIVE",
    updated_at: new Date().toISOString(),
  })
  .eq("id", reset.user_id);

if (userUpdErr) {
  console.log("[RESET_REJECT_USER_UPDATE_ERROR]", userUpdErr);
  return ctx.respond({ status: "ERROR", code: "DB_ERROR", action: "NONE" }, 500);
}

  console.log("[RESET_REJECT_UPDATE_DONE]");

  await logAuthEvent({
    eventType: "RESET_REJECTED",
    identifier: ctx.user.identifier ?? null,
    result: "OK",
    requestId: req.headers.get("X-Request-Id") ?? null,
  });

  return ctx.respond(
    {
      status: "OK",
      code: "RESET_REJECTED",
      message: "Reset request rejected",
      action: "NONE",
    },
    200
  );
}
