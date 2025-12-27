/*
 * File-ID: ID-8A
 * File-Path: supabase/functions/api/pipeline/acl.ts
 * Gate: 1
 * Phase: 1
 * Domain: ACL
 * Purpose: ACL decision contract enforcement (ALLOW / DENY)
 * Authority: Backend
 */

import type { ContextResult } from "./context.ts";

/*
 ─────────────────────────────────────────────
  Types
 ─────────────────────────────────────────────
*/

export type AclDecision = {
  decision: "ALLOW" | "DENY";
  reasonCode: string;
};

export type AclResult = {
  decision: AclDecision;
  response?: Response | null;
};

/*
 ─────────────────────────────────────────────
  ACL Deny Response Builder (frozen contract)
 ─────────────────────────────────────────────
*/

function aclDenyResponse(reasonCode: string): Response {
  return new Response(
    JSON.stringify({
      status: "ERROR",
      code: "ACL_DENIED",
      message: "Access denied by policy.",
      action: "NONE",
      reason: reasonCode,
      timestamp: new Date().toISOString(),
    }),
    {
      status: 403,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    }
  );
}

/*
 ─────────────────────────────────────────────
  ACL Resolver (Gate-1)
 ─────────────────────────────────────────────
*/

export async function resolveACL(
  _req: Request,
  _contextResult: ContextResult
): Promise<AclResult> {
  /*
   Gate-1:
   - Always ALLOW
   - But DENY contract is frozen here
  */

  const decision: AclDecision = {
    decision: "ALLOW",
    reasonCode: "ACL_PLACEHOLDER_GATE_1",
  };

  if (decision.decision === "DENY") {
    return {
      decision,
      response: aclDenyResponse(decision.reasonCode),
    };
  }

  return {
    decision,
    response: null,
  };
}
