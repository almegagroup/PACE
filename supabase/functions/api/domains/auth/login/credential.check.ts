// ============================================================================
// PACE-ERP :: AUTH DOMAIN
// Gate  : 2 (AUTH)
// ID    : 2.1A (Credential Validation)
// File  : credential.check.ts
// Role  : Validate login identifier & password correctness
// Status: ACTIVE (Gate-2 In Progress)
// ----------------------------------------------------------------------------
// SSOT RULE:
// - This file validates ONLY credential correctness
// - NO account policy checks (disabled / locked)
// - NO session creation
// - NO cookies
// ============================================================================



import { LOGIN_INTERNAL_FAILURE } from './login.types.ts';
import { getServiceDb } from './_internals/auth.db.ts';

function normalizeIdentifier(identifier?: string): string | null {
  if (!identifier || typeof identifier !== 'string') return null;

  const raw = identifier.trim().toLowerCase();
  return raw.includes('@') ? raw : `${raw}@pace.in`;
}

export async function checkCredentials(
  { identifier }: { identifier?: string }
) {
     // 🔍 DEBUG LOG — function entry
  console.log('[CRED] called with identifier =', identifier);
  if (!identifier) {
    console.log('[CRED] FAIL: identifier missing');
    return { ok: false, reason: LOGIN_INTERNAL_FAILURE.BAD_INPUT };
  }

  const canonicalId = normalizeIdentifier(identifier);
  console.log('[CRED] canonical identifier =', canonicalId);
  if (!canonicalId) {
    console.log('[CRED] FAIL: canonicalId invalid');
    return { ok: false, reason: LOGIN_INTERNAL_FAILURE.BAD_INPUT };
  }

  const db = getServiceDb();
  console.log('[CRED] service DB acquired');

  const { data: user, error } = await db
    .from('auth_users')
    .select('id, state')
    .eq('identifier', canonicalId)
    .single();
     // 🔍 DEBUG LOG — DB result
  console.log('[CRED] DB result user =', user);
  console.log('[CRED] DB error =', error);

  if (error || !user) {
     console.log('[CRED] FAIL: user not found');
    return { ok: false, reason: LOGIN_INTERNAL_FAILURE.USER_NOT_FOUND };
  }

  if (user.state !== 'ACTIVE') {
    console.log('[CRED] FAIL: user not ACTIVE, state =', user.state);
    return { ok: false, reason: LOGIN_INTERNAL_FAILURE.ACCOUNT_DISABLED };
  }
 console.log('[CRED] SUCCESS: user id =', user.id);
  return {
  ok: true,
  data: {
    id: user.id,
    account_state: user.state, // 🔥 THIS LINE
  },
};
}
