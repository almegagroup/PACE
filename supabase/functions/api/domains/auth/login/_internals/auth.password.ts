// ============================================================================
// PACE-ERP :: AUTH DOMAIN (INTERNAL)
// Gate  : 2 (AUTH)
// File  : auth.password.ts
// Role  : Password verification (DB-native, Edge-safe)
// Status: FINAL – DO NOT TOUCH
//
// AUTHORITY RULE:
// - Password verification authority = DATABASE ONLY
// - Edge acts as orchestrator, never as crypto authority
// - Uses pgcrypto crypt() via SECURITY DEFINER RPC
// ============================================================================

import { getServiceDb } from "./auth.db.ts";

export async function verifyPassword(
  userId: string,
  plain: string
): Promise<boolean> {
  if (!userId || !plain) return false;

  const db = getServiceDb();

  const { data, error } = await db.rpc(
    "verify_user_password",
    {
      p_user_id: userId,
      p_password: plain,
    }
  );

  if (error) {
    // Silent fail → login.handler will return generic 401
    return false;
  }

  return data === true;
}
