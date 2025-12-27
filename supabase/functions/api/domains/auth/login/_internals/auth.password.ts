// ============================================================================
// PACE-ERP :: AUTH DOMAIN (INTERNAL)
// Gate  : 2 (AUTH)
// File  : auth.password.ts
// Role  : Password verification using Postgres-compatible bcrypt (pgcrypto)
// Status: ACTIVE (Gate-2)
// ============================================================================

import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  try {
    if (!plain || !hash) return false;
    return await bcrypt.compare(plain, hash);
  } catch {
    return false; // fail-closed
  }
}
