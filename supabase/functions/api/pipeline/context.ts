/*
 * File-ID: ID-7A
 * File-Path: supabase/functions/api/pipeline/context.ts
 * Gate: 1
 * Phase: 1
 * Domain: CONTEXT
 * Purpose: Context resolver (SSOT compliant)
 * Authority: Backend
 */

import type { SessionResult } from "./session.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

/*
 ─────────────────────────────────────────────
  Types
 ─────────────────────────────────────────────
*/

export type ContextUniverse = "UNRESOLVED";

export type RequestContext = {
  companyId?: string;
  projectId?: string;
  departmentId?: string;

  // 🔑 BUSINESS AUTH (SSOT)
  role?: string;        // role_code (SA / GA / L1_USER)
  roleRank?: number;    // role_rank (999 / ...)
  identifier?: string;  // email / identifier

  universe: ContextUniverse;
};

export type ContextResult = {
  status: "OK" | "BLOCKED";
  context: RequestContext;
  response?: Response | null;
};

/*
 ─────────────────────────────────────────────
  Invariant Enforcement Hook
 ─────────────────────────────────────────────
*/

function enforceContextInvariants(
  context: RequestContext,
  session: SessionResult,
  req: Request
): Response | null {
  const path = new URL(req.url).pathname;
  

  // 🔒 ADMIN ROUTE HARD INVARIANT
  if (path.startsWith("/admin/")) {
    if (!context.role || !context.identifier) {
      return new Response(
        JSON.stringify({
          error: "ADMIN_CONTEXT_MISSING",
          message: "Admin request requires authenticated SA context",
        }),
        { status: 401 }
      );
    }
  }

  return null;
}

/*
 ─────────────────────────────────────────────
  Context Resolver (FINAL)
 ─────────────────────────────────────────────
*/

export async function resolveContext(
  req: Request,
  session: SessionResult
): Promise<ContextResult> {
  const context: RequestContext = {
    universe: "UNRESOLVED",
  };

  // ─────────────────────────────
  // 1️⃣ Resolve authenticated user
  // ─────────────────────────────
  if (session.status === "CLAIMED" && session.sessionId) {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Step-1: resolve auth session
    const { data: erpSession, error: sErr } = await supabase
  .schema("secure")
  .from("erp_sessions")
  .select("user_id, state")
  .eq("id", session.sessionId)
  .single();

    if (sErr || !erpSession) {
     return {
  status: "BLOCKED",
  context,
  response: new Response(
    JSON.stringify({
      error: "SESSION_RESOLVE_FAILED",
      message: "Invalid or expired session",
    }),
    { status: 401 }
  ),
};
    }

    // Step-2: resolve auth user
    const { data: user, error: uErr } = await supabase
  .schema("secure")
  .from("auth_users")
  .select("identifier, role_code, role_rank")
  .eq("id", erpSession.user_id)
  .single();

    if (uErr || !user) {
      return {
        status: "BLOCKED",
        context,
        response: new Response(
          JSON.stringify({
            error: "AUTH_USER_RESOLVE_FAILED",
            message: "Authenticated user not found",
          }),
          { status: 401 }
        ),
      };
    }

    // ✅ SSOT population
    context.identifier = user.identifier;
    context.role = user.role_code;
    context.roleRank = user.role_rank;
  }

  // ─────────────────────────────
  // 2️⃣ Enforce invariants
  // ─────────────────────────────
  const invariantResponse = enforceContextInvariants(context, session, req);
  if (invariantResponse) {
    return {
      status: "BLOCKED",
      context,
      response: invariantResponse,
    };
  }
console.log("[CTX_RESOLVED]", {
  identifier: context.identifier,
  role: context.role,
  roleRank: context.roleRank,
});
  // ─────────────────────────────
  // 3️⃣ Return resolved context
  // ─────────────────────────────
  return {
    status: "OK",
    context,
    response: null,
  };
}
