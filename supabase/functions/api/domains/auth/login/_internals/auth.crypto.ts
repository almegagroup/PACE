// ============================================================================
// PACE-ERP :: AUTH DOMAIN (INTERNAL)
// Gate  : 2 (AUTH)
// File  : auth.crypto.ts
// Role  : Temporary crypto helpers for Gate-2 login flow
// Status: TEMP (Replace in Gate-3)
// ----------------------------------------------------------------------------
// SSOT RULE:
// - This is NOT final crypto implementation
// - Used only to unblock Gate-2 compilation
// - Must be replaced by real secure crypto later
// ============================================================================

/**
 * Generate a temporary session identifier.
 * NOTE:
 * - This is NOT cryptographically secure
 * - Intentional stub for Gate-2 only
 */
export function cryptoRandomId(): string {
  return crypto.randomUUID();
}
