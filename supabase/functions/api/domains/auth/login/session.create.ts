// ============================================================================
// PACE-ERP :: AUTH DOMAIN
// Gate  : 2 (AUTH)
// ID    : 2.1C (Session Creation)
// File  : session.create.ts
// Role  : Create authoritative server-side login session
// Status: ACTIVE (Gate-2 In Progress)
// ----------------------------------------------------------------------------
// SSOT RULE:
// - Session is the ONLY proof of login
// - Cookie is NOT authority (transport only)
// - Fail-closed: if session is not created, login fails
// - No role / context / ACL here
/* ============================================================================
 * SECURITY CONTRACT (Gate-3.6):
 * ---------------------------------------------------------------------------
 * - This function ALWAYS generates a brand-new session identifier.
 * - It MUST NOT be used to resume or refresh an existing session.
 * - Caller is responsible for revoking all other active sessions
 *   BEFORE or IMMEDIATELY AFTER successful creation.
 * - Any reuse of session_id across login boundaries is forbidden.
 * ============================================================================
 */
// NOTE (Gate-3.6A):
// - Session creation does NOT imply cookie issuance.
// - Transport layer MUST regenerate HttpOnly session cookie
//   for every successful login using the new session_id.

// ============================================================================

import { LOGIN_INTERNAL_FAILURE } from './login.types.ts';
import { getServiceDb } from './_internals/auth.db.ts';
import { cryptoRandomId } from './_internals/auth.crypto.ts';
import { generateDeviceTag } from './_internals/device.tag.ts';
import { logSessionTransition } from "./_internals/session.timeline.ts";

/* ============================================================================
 * SESSION POLICY (Gate-2 minimal)
 * ---------------------------------------------------------------------------
 * TTL is fixed and simple for now.
 * Lifecycle expansion will happen in Gate-3.
 * ============================================================================
 */
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

/* ============================================================================
 * createSession
 * ---------------------------------------------------------------------------
 * Responsibilities:
 * - Generate secure session_id
 * - Persist session in auth_sessions table
 * - Return session metadata to caller (internal only)
 * ============================================================================
 */
export async function createSession(
  user: { id: string },
  req: Request
) {
     console.log('[SESSION_CREATE] CALLED WITH USER', user);
  if (!user || !user.id) {
    return {
      ok: false,
      reason: LOGIN_INTERNAL_FAILURE.SESSION_CREATE_FAILED,
    };
  }

  const db = getServiceDb();

  // -------- Generate session identifiers --------
  const sessionId = cryptoRandomId();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + SESSION_TTL_SECONDS * 1000,
  );
  console.log('[SESSION_CREATE] INSERT PAYLOAD', {
  user_id: user.id,
  session_token: sessionId,
  status: 'ACTIVE',
  expires_at: expiresAt.toISOString(),
});
 // ✅ Gate-3.5 Device Tag (SOFT, non-PII)
  const deviceTag = generateDeviceTag(req);
  // -------- Insert session record --------
 const { error } = await db.from("secure.erp_sessions").insert({
    id: sessionId,
    user_id: user.id,
    state: "ACTIVE",
    last_activity_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    device_tag: deviceTag,
  });

  if (error) {
    console.error('[SESSION_CREATE] INSERT FAILED', error);
    return {
      ok: false,
      reason: LOGIN_INTERNAL_FAILURE.SESSION_CREATE_FAILED,
    };
  }
// ─────────────────────────────────────────
// ID-3.8 :: Session Timeline Log (LOGIN)
// ─────────────────────────────────────────
await logSessionTransition({
  sessionId,
  userId: user.id,
  fromState: "NONE", // optional clarity
  toState: "ACTIVE",
  event: "LOGIN",
  requestId: req.headers.get("X-Request-Id") ?? undefined,
  source: "session.create",
});

  // -------- Success --------
  return {
    ok: true,
    data: {
      session_id: sessionId,
      expires_at: expiresAt,
    },
  };
}
