# HEALTH ENDPOINT — Gate-0

## Purpose
Provide a deterministic liveness signal for infrastructure,
CI/CD pipelines, and monitoring systems.

## Endpoint
GET /health

## Rules
- No authentication
- No database access
- No session resolution
- No ACL checks
- No side effects

## Response (HTTP 200)
{
  "status": "OK",
  "service": "PACE-ERP",
  "gate": "0",
  "timestamp": "<ISO-8601 UTC>"
}

## Failure Semantics
- If runtime cannot serve this endpoint, system is considered DOWN
- No retries or fallbacks inside application logic

## Immutability
- Health endpoint behavior is frozen after Gate-0
- Any change requires a new Gate
