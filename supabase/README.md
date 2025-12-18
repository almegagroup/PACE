# PACE ERP — One Codepath Rule
Gate-0 / ID-0.4A

## Rule (Non-Negotiable)

- The same backend code must run in:
  - Local emulator
  - Dev environment
  - Production

## Disallowed

- Environment-based branching in code
- Dev-only or prod-only logic paths
- Separate API entry points per environment

## Allowed Differences

- Configuration (ports, URLs)
- Secrets (keys, tokens)
- Infrastructure wiring

## Principle

Code is immutable across environments.
Only configuration changes.
