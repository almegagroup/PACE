// ============================================================================
// PACE-ERP :: AUTH DOMAIN (INTERNAL)
// Gate  : 2 (AUTH)
// File  : auth.password.ts
// Role  : Password verification (Edge-safe, pure JS)
// Status: FINAL – DO NOT TOUCH
// ============================================================================

import bcrypt from "https://esm.sh/bcryptjs@2.4.3";
import { getServiceDb } from "./auth.db.ts";

export async function verifyPassword(
  userId: string,
  plain: string
): Promise<boolean> {
  if (!userId || !plain) return false;

  const db = getServiceDb();

  const { data, error } = await db
    .from("secure.auth_credentials")
    .select("password_hash")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.password_hash) return false;

  return bcrypt.compareSync(plain, data.password_hash);
}
