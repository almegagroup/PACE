/*
 * File-ID: ID-7A
 * File-Path: supabase/functions/api/pipeline/context.ts
 * Gate: 1
 * Phase: 1
 * Domain: CONTEXT
 * Purpose: Context resolver skeleton with invariant placeholders
 * Authority: Backend
 */

import type { SessionResult } from "./session.ts";

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
  universe: ContextUniverse;
};

export type ContextResult = {
  status: "OK" | "BLOCKED";
  context: RequestContext;
  response?: Response | null;
};

/*
 ─────────────────────────────────────────────
  Invariant Enforcement Hook (NO-OP for Gate-1)
 ─────────────────────────────────────────────
*/

function enforceContextInvariants(
  _context: RequestContext,
  _session: SessionResult
): Response | null {
  /*
   Gate-1:
   - No invariants enforced
   - No blocking
   - No assumptions

   Gate-5+:
   - Single company invariant
   - Project ∈ company
   - Department ∈ company
   - SA/GA bypass isolation
  */
  return null;
}

/*
 ─────────────────────────────────────────────
  Context Resolver
 ─────────────────────────────────────────────
*/

export async function resolveContext(
  _req: Request,
  session: SessionResult
): Promise<ContextResult> {
  const context: RequestContext = {
    universe: "UNRESOLVED",
  };

  // Invariant hook (does nothing in Gate-1)
  const invariantResponse = enforceContextInvariants(context, session);
  if (invariantResponse) {
    return {
      status: "BLOCKED",
      context,
      response: invariantResponse,
    };
  }

  return {
    status: "OK",
    context,
    response: null,
  };
}
