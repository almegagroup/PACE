# Service Role Usage Policy
Gate-0 / ID-0.5

## Purpose
Protect Supabase service role key from misuse or leakage.

## Rules (Non-Negotiable)

- Service role key MUST NEVER be:
  - Committed to git
  - Used in frontend code
  - Exposed to browser or client apps

- Service role key MAY ONLY be used by:
  - Supabase Edge Functions
  - Backend-only execution paths

## Enforcement

- All database writes that bypass RLS must originate from backend code
- Frontend operates with ZERO database authority

## Violation

Any violation of this policy is a critical security breach.
