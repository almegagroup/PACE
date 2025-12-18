# File ID Tagging Standard (Gate-0)

## Purpose
This document defines the mandatory file-level identification header
for all files in the PACE ERP repository.

This standard ensures:
- Full traceability across Gate / Phase / Domain
- Clear ownership and authority
- Deterministic review and auditability
- Future CI enforcement compatibility

---

## Mandatory Header Format

Every file MUST start with a header containing the following fields:

/*

File-ID: <ID>

File-Path: <repo-relative-path>

Gate: <Gate-No>

Phase: <Phase-No>

Domain: <Domain>

Purpose: <One-line purpose>

Authority: <Frontend | Backend | DB | Docs>
*/

---

## Examples

### Backend (Edge Function)

/*

File-ID: 0.7A

File-Path: supabase/functions/health/index.ts

Gate: 0

Phase: 0

Domain: OBSERVABILITY

Purpose: Health liveness probe

Authority: Backend
*/


---

### Database (SQL Migration)



/*

File-ID: 0.6C

File-Path: supabase/migrations/20251218_gate0_default_deny_policies.sql

Gate: 0

Phase: 0

Domain: DB

Purpose: Default deny RLS policies

Authority: Database
*/


---

### Documentation


<!-- File-ID: 0.6A File-Path: docs/DB_RLS_PHILOSOPHY.md Gate: 0 Phase: 0 Domain: DB Purpose: RLS philosophy definition Authority: Docs -->

---

## Enforcement Rule

- Any file missing this header is considered **INVALID by standard**
- Manual enforcement applies during Gate-0
- Automated enforcement will be introduced in **ID-0.8A**

---

## Scope

- Applies to all new and existing files
- Mandatory from Gate-0 onward
- Cannot be bypassed or ignored

---

## Status

- Defined in Gate-0
- Enforcement pending (ID-0.8A)