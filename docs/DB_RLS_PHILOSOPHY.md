# Row Level Security (RLS) Philosophy
Gate-0 / ID-0.6A

## Core Principle
Default Deny. No implicit access.

## Rules (Non-Negotiable)

- All tables MUST have RLS enabled
- Without an explicit policy, access is DENIED
- Authenticated user does NOT imply authorized user
- Authorization is evaluated per row

## Trust Model

- Frontend: ZERO trust
- Auth token: Identity only, not permission
- Backend (service role): Controlled bypass only

## Allowed Access

- Explicit RLS policies only
- Service role may bypass RLS for backend operations

## Disallowed

- Public read/write without RLS
- Relying on frontend filtering
- Broad policies like `true = true`

## Principle

Access must be proven, never assumed.
