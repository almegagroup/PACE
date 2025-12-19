-- Gate-0 / ID-0.6
-- Database Schema Namespace Initialization

BEGIN;

-- Secure schema for core business data
CREATE SCHEMA IF NOT EXISTS secure;

-- Audit schema for immutable logs
CREATE SCHEMA IF NOT EXISTS audit;

-- Safety comments
COMMENT ON SCHEMA secure IS 'Protected business data. RLS enforced.';
COMMENT ON SCHEMA audit IS 'Append-only audit logs and security events.';

COMMIT;
