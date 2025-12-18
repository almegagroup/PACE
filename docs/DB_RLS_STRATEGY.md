# RLS Enable Strategy
Gate-0 / ID-0.6A

## Activation Order

1. Enable RLS on every table
2. Apply default deny policies
3. Add explicit allow policies per use-case
4. Test access using anon and auth roles
5. Allow service role bypass only for backend

## Default State

- RLS enabled
- No SELECT / INSERT / UPDATE / DELETE allowed
- Access = DENIED

## Policy Granularity

- Policies are per table
- Policies are per action (SELECT, INSERT, UPDATE, DELETE)
- Policies are evaluated per row

## Backend Bypass

- Service role bypass is allowed
- Only via backend execution paths
- Never exposed to frontend

## Principle

Secure first. Open deliberately.
