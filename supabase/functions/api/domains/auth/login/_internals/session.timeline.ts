// ============================================================================
// PACE-ERP :: AUTH DOMAIN (INTERNAL)
// ---------------------------------------------------------------------------
// File-ID : ID-3.8
// Gate    : 3
// Phase   : 3
// Domain  : OBSERVABILITY / SESSION
// File    : session.timeline.ts
// Role    : Append-only session lifecycle timeline logger
// Status  : ACTIVE (Gate-3 Observability)
//
// ───────────────────────────────────────────────────────────────────────────
// SSOT RULES:
// - This file is the SINGLE authority for session timeline logging
// - Append-only (NO update / delete)
// - MUST NEVER block or affect auth/session logic
// - Service-role DB access only
// - requestId is best-effort (nullable)
//
// PURPOSE (ID-3.8):
// - Log session state transitions for RCA readiness
// - Correlate session lifecycle with requestId
//
// NON-GOALS:
// - No metrics
// - No business logic
// - No security decisions
// ============================================================================

import { getServiceDb } from "./auth.db.ts";

/* ============================================================================
 * logSessionTransition
 * ---------------------------------------------------------------------------
 * Logs a single session state transition into erp_session_timeline.
 *
 * IMPORTANT CONTRACT:
 * - This function MUST be fire-and-forget
 * - Failure MUST NOT impact caller
 * - Caller controls correctness of state semantics
 * ============================================================================
 */
export async function logSessionTransition(opts: {
  sessionId: string;
  userId?: string;
  fromState?: string;
  toState: string;
  event: string;
  requestId?: string;
  source: string;
}): Promise<void> {
  try {
    await getServiceDb()
      .from("erp_session_timeline")
      .insert({
        session_id: opts.sessionId,
        user_id: opts.userId ?? null,
        from_state: opts.fromState ?? null,
        to_state: opts.toState,
        event: opts.event,
        request_id: opts.requestId ?? null,
        source: opts.source,
      });
  } catch (err) {
    // -----------------------------------------------------------------------
    // OBSERVABILITY MUST NEVER BREAK AUTH
    // -----------------------------------------------------------------------
    console.error("[Gate-3.8] session timeline logging failed", {
      sessionId: opts.sessionId,
      event: opts.event,
      source: opts.source,
      error: err,
    });
  }
}
