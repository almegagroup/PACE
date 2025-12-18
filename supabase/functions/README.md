# Backend Functions — One Codepath Guard
Gate-0 / ID-0.4A

All Edge Functions must follow the One Codepath Rule.

## Forbidden

- Environment-based logic branching
- Local-only or prod-only behavior
- Conditional behavior based on NODE_ENV

## Enforcement

Any function violating this rule is invalid and must not be deployed.
