// ============================================================================
// PACE-ERP :: ADMIN DOMAIN
// Gate  : 3
// ID    : 3.4 (Admin Force Revoke)
// File  : revoke.handler.ts
// Role  : Emergency session revocation
// ----------------------------------------------------------------------------
// RULES:
// - Super Admin ONLY
// - No frontend session trust
// ============================================================================

import { adminForceRevokeSessions } from "../../auth/login/_internals/auth.db.ts";

export async function adminRevokeSessionsHandler(
  req: Request,
  ctx: { user: any; respond: Function }
) {
  // ── Super Admin check
  if (!ctx.user || ctx.user.role !== "SUPER_ADMIN") {
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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return ctx.respond(
      {
        status: "ERROR",
        code: "INVALID_REQUEST",
        action: "NONE",
      },
      400
    );
  }

  const { userId } = body || {};
  if (!userId) {
    return ctx.respond(
      {
        status: "ERROR",
        code: "INVALID_REQUEST",
        action: "NONE",
      },
      400
    );
  }

  await adminForceRevokeSessions(userId, ctx.user.id);

  return ctx.respond(
    {
      status: "OK",
      code: "ADMIN_SESSION_REVOKED",
      message: "All sessions revoked successfully",
      action: "NONE",
    },
    200
  );
}
