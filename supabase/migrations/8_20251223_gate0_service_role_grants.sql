-- Gate-0 PATCH
-- Explicit service_role grants for secure & audit schemas
-- Reason: db reset wipes implicit privileges

BEGIN;

-- Allow service role to use schemas
GRANT USAGE ON SCHEMA secure TO service_role;
GRANT USAGE ON SCHEMA audit  TO service_role;

-- Allow service role full access to existing tables
GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA secure
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA audit
TO service_role;

-- Future-proof: tables created later
ALTER DEFAULT PRIVILEGES IN SCHEMA secure
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLES
TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA audit
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLES
TO service_role;

COMMIT;
