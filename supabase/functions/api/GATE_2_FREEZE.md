# PACE-ERP — GATE-2 FREEZE DECLARATION

Project : PACE-ERP  
Gate    : 2 (Authentication Authority)  
Status  : FROZEN & IMMUTABLE  
Date    : 2025-12-23  

---

## PURPOSE

This document declares **Gate-2** as COMPLETE and FROZEN.

From this point onward:

- Authentication behavior is FINAL
- Auth = Identity ONLY
- No role, permission, or context may enter auth
- Any modification requires **Gate-3 or higher**
- This file is a **canonical SSOT reference**

This document EXTENDS Gate-1 freeze and covers **Gate-0 → Gate-2** in full.

---

## DEFINITIONS (GLOBAL SSOT)

- **Auth** = Identity verification only
- **Session** = Proof of authentication
- **Authorization** = Explicitly NOT part of Gate-2
- **Frontend** = NEVER source of truth
- **Backend** = Absolute authority

---

# GATE-0 — FOUNDATION (RECAP)

| ID | Gate | Domain | Short Name | Purpose |
|----|------|--------|------------|---------|
| 0 | 0 | SYSTEM | Repo foundation | Establish mono-repo & CI discipline |
| 0.1 | 0 | SYSTEM | Backend SSOT | Backend is single authority |
| 0.2 | 0 | SYSTEM | Frontend zero trust | Frontend is never trusted |
| 0.3 | 0 | DB | RLS default deny | Secure-by-default database |
| 0.4 | 0 | DB | Service role isolation | No client DB access |
| 0.5 | 0 | GOVERNANCE | Gate discipline | All changes gated |

**Gate-0 Status:** FROZEN

---

# GATE-1 — PIPELINE & SECURITY (RECAP)

| ID | Gate | Domain | Short Name | Purpose |
|----|------|--------|------------|---------|
| 1 | 1 | BACKEND | Deterministic pipeline | Single request entry |
| 1.1 | 1 | SECURITY | Security headers | CSP, XSS, etc |
| 1.2 | 1 | SECURITY | CORS control | Explicit origins only |
| 1.3 | 1 | SECURITY | CSRF defense | Token-based |
| 1.4 | 1 | SECURITY | Rate limit framework | Hook only (policy later) |
| 1.5 | 1 | SESSION | Session resolver | Read-only session detection |
| 1.6 | 1 | ACL | ACL skeleton | No enforcement yet |
| 1.7 | 1 | ERROR | Unified response | SSOT response envelope |

**Gate-1 Status:** FROZEN

---

# GATE-2 — AUTHENTICATION AUTHORITY (NEW)

## CORE PRINCIPLE

> **Auth = Identity ONLY**

No permissions  
No roles  
No context  
No ACL  

---

## GATE-2 COMPLETE TABLE (FULL)

| ID | Gate | Domain | Short Name | What It Locks |
|----|------|--------|------------|---------------|
| 2 | 2 | AUTH | Auth boundary | Auth ≠ authorization |
| 2.1 | 2 | AUTH | Login API | Server-side login only |
| 2.1A | 2 | AUTH | Credential validation | Identifier + password |
| 2.1B | 2 | AUTH | Account state check | DISABLED / LOCKED block |
| 2.1C | 2 | AUTH | Session creation | ACTIVE session intent |
| 2.2 | 2 | SESSION | HttpOnly cookie issue | Secure cookie transport |
| 2.2A | 2 | SESSION | Cookie hardening | Path / Domain / SameSite |
| 2.2B | 2 | SESSION | Cookie overwrite | Fixation prevention |
| 2.3 | 2 | AUTH | `/auth/me` | Backend login truth |
| 2.3A | 2 | AUTH | No-guess contract | Frontend reacts only |
| 2.3B | 2 | AUTH | Minimal payload | No role/ACL leak |
| 2.4 | 2 | AUTH | Logout intent | Intent only, idempotent |
| 2.4A | 2 | AUTH | Cookie invalidation | Immediate transport cleanup |
| 2.4B | 2 | AUTH | Idempotent logout | Safe repeated calls |
| 2.5 | 2 | SECURITY | Auth rate limit | Login abuse prevention |
| 2.5A | 2 | SECURITY | IP throttling | Brute-force defense |
| 2.5B | 2 | SECURITY | Account throttling | Credential stuffing |
| 2.6 | 2 | SECURITY | Error code mapping | Deterministic UX |
| 2.6A | 2 | SECURITY | Generic messages | Enumeration prevention |
| 2.7 | 2 | OBS | Auth audit logs | Minimal, best-effort |
| 2.8 | 2 | DOCS | Gate-2 freeze | Auth authority lock |

**Gate-2 Status:** FROZEN

---

## VERIFIED BEHAVIOR (LOCKED)

- Login success → cookie issued → `/auth/me` OK
- Login failure → generic error only
- Rate-limit → `AUTH_RATE_LIMITED` + BLOCKED audit
- Logout → cookie cleared + LOGOUT audit
- `/auth/me` after logout → AUTH_NOT_LOGGED_IN
- No role / permission leakage anywhere

---

## ABSOLUTE PROHIBITIONS

The following are PERMANENTLY FORBIDDEN:

- Adding role/permission to auth
- Returning context in `/auth/me`
- Revoking DB session in logout (Gate-3+ only)
- Frontend-based auth truth
- Cookie logic outside response layer
- Modifying auth without new Gate

---

## NEXT ALLOWED WORK

- Gate-3: Session lifecycle
- Gate-4: User lifecycle
- Gate-5: Context resolution
- Gate-6: ACL enforcement

---

## FINAL DECLARATION

Gate-0 : FROZEN  
Gate-1 : FROZEN  
Gate-2 : FROZEN  

This document is **SSOT**.

Any violation = architectural breach.
