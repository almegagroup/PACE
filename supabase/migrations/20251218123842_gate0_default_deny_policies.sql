-- Gate-0 / ID-0.6C
-- Default DENY policies for Zero-Trust posture

BEGIN;

-- NOTE:
-- With RLS enabled and FORCE RLS on,
-- absence of ALLOW policies results in DENY by default.
-- This migration asserts that posture and prevents future ambiguity.

-- Safety: ensure schemas exist
CREATE SCHEMA IF NOT EXISTS secure;
CREATE SCHEMA IF NOT EXISTS audit;

-- Re-assert FORCE RLS on all existing tables (defensive)
DO $$
DECLARE
    r RECORD;
BEGIN
    -- secure schema
    FOR r IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'secure'
    LOOP
        EXECUTE format('ALTER TABLE secure.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
        EXECUTE format('ALTER TABLE secure.%I FORCE ROW LEVEL SECURITY;', r.tablename);
    END LOOP;

    -- audit schema
    FOR r IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'audit'
    LOOP
        EXECUTE format('ALTER TABLE audit.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
        EXECUTE format('ALTER TABLE audit.%I FORCE ROW LEVEL SECURITY;', r.tablename);
    END LOOP;
END;
$$;

-- No ALLOW policies are created here by design.
-- Access remains DENIED until explicitly granted in later phases.

COMMIT;
