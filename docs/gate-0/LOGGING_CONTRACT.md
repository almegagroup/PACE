# LOGGING CONTRACT — Gate-0

## Purpose
Establish a single, structured, backend-only logging standard
for all future APIs and background processes.

## Principles
- Frontend NEVER logs authority decisions
- Backend logs are the single source of truth
- Logs are machine-readable (JSON)
- Every request is traceable via request_id

## Mandatory Log Fields (All Logs)

- timestamp        (ISO-8601, UTC)
- level            (INFO | WARN | ERROR | SECURITY)
- request_id       (UUID, generated per request)
- source           (api | edge | cron | system)
- action           (semantic action name)
- user_id          (nullable)
- company_id       (nullable)
- project_id       (nullable)
- outcome          (SUCCESS | DENY | FAIL)
- error_code       (nullable)
- message          (human-readable summary)

## Example Log (JSON)

{
  "timestamp": "2025-12-18T18:45:12Z",
  "level": "INFO",
  "request_id": "b1a7c1e2-9f3c-4a8e-9e21-33f5b1d2e900",
  "source": "api",
  "action": "SESSION_RESOLVE",
  "user_id": "u_1029",
  "company_id": "c_12",
  "project_id": "p_9",
  "outcome": "SUCCESS",
  "error_code": null,
  "message": "Session resolved successfully"
}

## Enforcement
- Logging is mandatory for all backend entry points
- Missing logs are treated as implementation bugs
- Log format is immutable after Gate-0 freeze
## Request ID Generation

- Generated at backend entry point (Edge Function)
- UUID v4 format
- One request_id per HTTP request
- Propagated through all internal layers
- Included in every log and error response
