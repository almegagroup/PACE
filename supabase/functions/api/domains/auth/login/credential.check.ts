// ============================================================================
// PACE-ERP :: AUTH DOMAIN
// Gate  : 2 (AUTH)
// ID    : 2.1A (Credential Validation)
// File  : credential.check.ts
// Role  : Validate login identifier existence & basic eligibility
// Status: ACTIVE (Gate-2)
// ----------------------------------------------------------------------------
// SSOT RULE:
// - This file validates ONLY identifier existence
// - NO password verification
// - NO account policy enforcement (LOCKED / DISABLED)
// - NO session creation
// - NO cookies
// ============================================================================

import { LOGIN_INTERNAL_FAILURE } from "./login.types.ts";
import { getServiceDb } from "./_internals/auth.db.ts";

/* ─────────────────────────────────────────
 * Normalize identifier to canonical form
 * ───────────────────────────────────────── */
function normalizeIdentifier(identifier?: string): string | null {
  if (!identifier || typeof identifier !== "string") return null;

  const raw = identifier.trim().toLowerCase();
  return raw.includes("@") ? raw : `${raw}@pace.in`;
}

/* ─────────────────────────────────────────
 * checkCredentials
 * ─────────────────────────────────────────
 * Responsibility:
 * - Ensure identifier exists in secure.auth_users
 * - Return minimal user identity for downstream steps
 * - Do NOT validate password
 * ───────────────────────────────────────── */
export async function checkCredentials(
  { identifier }: { identifier?: string }
) {
  // Defensive input validation
  if (!identifier) {
    return {
      ok: false,
      reason: LOGIN_INTERNAL_FAILURE.BAD_INPUT,
    };
  }

  const canonicalId = normalizeIdentifier(identifier);
  if (!canonicalId) {
    return {
      ok: false,
      reason: LOGIN_INTERNAL_FAILURE.BAD_INPUT,
    };
  }

  // Service-role DB (secure schema)
  const db = getServiceDb();

  const { data: user, error } = await db
    .from("auth_users")
    .select("id, state")
    .eq("identifier", canonicalId)
    .maybeSingle();

  if (error || !user) {
    return {
      ok: false,
      reason: LOGIN_INTERNAL_FAILURE.USER_NOT_FOUND,
    };
  }

  // NOTE:
  // - State is NOT enforced here
  // - Passed through for ID-2.1B (account.state.ts)
  return {
    ok: true,
    data: {
      id: user.id,
      account_state: user.state,
    },
  };
}
