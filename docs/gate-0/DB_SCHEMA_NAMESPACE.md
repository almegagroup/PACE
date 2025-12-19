# Database Schema Namespace
Gate-0 / ID-0.6

## Purpose
Define clear separation of data responsibility in the database.

## Schemas

### public
- Read-only views
- Non-sensitive reference data
- Exposed via API selectively

### secure
- Core transactional tables
- User, role, ACL, workflow data
- Protected by RLS

### audit
- Immutable audit logs
- Security events
- Admin actions

## Rules (Non-Negotiable)

- No business-critical table in public schema
- All sensitive tables MUST live in secure schema
- Audit schema is append-only

## Principle

Structure first. Tables later.
