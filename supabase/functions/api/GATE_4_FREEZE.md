# GATE‑4 FREEZE DECLARATION (AUTH & GOVERNANCE)

**Project:** PACE‑ERP  
**Gate:** 4 (Signup → Approval → First Login → Recovery/Reset)  
**Status:** FINAL / FROZEN / IMMUTABLE  
**Effective From:** 2026‑01‑14

---

## 1. PURPOSE OF GATE‑4

Gate‑4 defines and permanently locks the **entire user lifecycle boundary** for PACE‑ERP authentication.  
From the moment a user requests signup until the last possible recovery/reset scenario, **all states, transitions, APIs, RPCs, and constraints are fixed**.

After this freeze:
- No behavioural change is allowed inside Gate‑4
- Any future change **must** be introduced via a new Gate or a versioned override

---

## 2. SCOPE (WHAT THIS GATE COVERS)

Gate‑4 covers **ALL** of the following:

1. Public signup request
2. Admin approval / rejection
3. Atomic user creation
4. First login enforcement
5. Forgot password / forgot passcode (self‑service)
6. Admin‑governed reset (both credentials lost)
7. Reset approval & execution
8. Post‑reset enforcement
9. Audit & enumeration safety guarantees

---

## 3. CANONICAL USER STATES (LOCKED)

The following values are the **only valid states** for `secure.auth_users.state`:

- `PENDING_APPROVAL`
- `FIRST_LOGIN_REQUIRED`
- `ACTIVE`
- `RESET_REQUIRED`
- `DISABLED`

No other state is permitted.

---

## 4. SIGNUP FLOW (4.1 → 4.3)

### 4.1 Signup Request (Public)

**Endpoint:** `/auth/signup-request`  
**Handler:** `signupRequest.handler.ts`

Rules:
- Public endpoint
- Human verification mandatory
- Enumeration safe (generic success always)
- Creates **PENDING** signup request only

No user record is created here.

---

### 4.2 Admin Approval

**Endpoint:** `/api/admin/signup/approve`  
**Handlers:**
- `list.handler.ts`
- `approval.handler.ts`

Rules:
- Super Admin only
- Explicit approve / reject
- Fully audited

---

### 4.2A Atomic User Creation

**Handler:** `createUser.handler.ts`

On approval:
- User row created in `secure.auth_users`
- Credentials row created in `secure.auth_credentials`
- User state = `FIRST_LOGIN_REQUIRED`
- `force_first_login = true`

All in **one transaction**.

---

### 4.3 First Login Enforcement

**Endpoint:** `/auth/first-login`  
**Handler:** `firstLogin.handler.ts`  
**RPC:** `first_login_complete`

Rules:
- Public endpoint
- Human verification mandatory
- No old password/passcode check
- Sets password + passcode
- Clears `force_first_login`
- Transitions state → `ACTIVE`

First login **never creates a session**.

---

## 5. SELF‑SERVICE RECOVERY (FORGOT FLOWS)

### 5.1 Forgot Password

**Endpoint:** `/auth/forgot-password`  
**Handler:** `forgotPassword.handler.ts`

Rules:
- User remembers passcode
- Only password is reset
- State remains `ACTIVE`

---

### 5.2 Forgot Passcode

**Endpoint:** `/auth/forgot-passcode`  
**Handler:** `forgotPasscode.handler.ts`

Rules:
- User remembers password
- Only passcode is reset
- State remains `ACTIVE`

---

## 6. ADMIN‑GOVERNED RESET (4.4 → 4.6)

### 6.1 Reset Request (Public)

**Endpoint:** `/auth/reset-request`  
**Handler:** `resetRequest.handler.ts`  
**RPC:** `request_auth_reset`

Rules:
- Used ONLY when both password & passcode are lost
- Enumeration safe
- Human verification mandatory
- Immediately sets user → `RESET_REQUIRED`
- Revokes sessions (best‑effort)
- Creates `auth_reset_requests` row (REQUESTED)

---

### 6.2 Reset Approval (Admin)

**Endpoint:** `/api/admin/auth/reset-requests/:id/approve`  
**Handler:** `adminReset.handler.ts`

Rules:
- Super Admin only
- Approving reset:
  - User state → `RESET_REQUIRED`
  - No FIRST_LOGIN logic allowed

Only **one active APPROVED reset per user** is allowed.
Older requests are archived automatically.

---

### 6.3 Reset Completion

**Endpoint:** `/auth/reset-complete`  
**Handler:** `resetComplete.handler.ts`  
**RPC:** `reset_complete`

Rules:
- Public endpoint
- Human verification mandatory
- User must be in `RESET_REQUIRED`
- Only the **latest APPROVED reset** is executed
- Password + passcode both updated
- User state → `ACTIVE`
- Reset request → `EXECUTED`

---

### 6.4 Post‑Reset Enforcement (Gate‑4.6)

Guarantees:
- All prior sessions are invalid
- User must login again with new credentials
- No residual access remains

---

## 7. AUDIT & SECURITY GUARANTEES

- All critical actions are audited
- Enumeration safety is enforced everywhere
- DB is the **Single Source of Truth**
- Handlers never bypass RPC logic

---

## 8. ARCHIVAL & CONSTRAINT RULES

- Only one active reset (REQUESTED/APPROVED) per user
- Old resets are auto‑archived
- Unique constraints enforced at DB level

---

## 9. IMMUTABILITY DECLARATION

From this point forward:

- Signup lifecycle is frozen
- First‑login behaviour is frozen
- Reset & recovery behaviour is frozen

Any change requires:
- New Gate (Gate‑5+) **OR**
- Explicit versioned override

---

## 10. GATE‑4 STATUS

**GATE‑4: CLOSED ✅**

This document is the **final authoritative reference** for all authentication and onboarding behaviour in PACE‑ERP.

