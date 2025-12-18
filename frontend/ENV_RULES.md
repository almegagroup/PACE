# PACE ERP — Frontend Environment Rules
Gate-0 / ID-0.2B

## RULES (NON-NEGOTIABLE)

- ❌ No database keys
- ❌ No Supabase keys
- ❌ No service role
- ❌ No auth secrets
- ❌ No API secrets

## Allowed

- ✅ Public feature flags (non-sensitive)
- ✅ UI-only config
- ✅ Build-time flags (non-secret)

## Enforcement

- Frontend must never connect directly to backend services
- All sensitive operations happen via backend APIs only
## Environment Rule

Only variables prefixed with `VITE_` are accessible in frontend.
No secrets are allowed.