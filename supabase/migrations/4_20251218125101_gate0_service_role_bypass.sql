-- Gate-0 / ID-0.6D
-- Controlled Service Role Bypass (RLS Escape Hatch)

BEGIN;

-- IMPORTANT:
-- PostgreSQL role with BYPASSRLS privilege (service role)
-- may bypass RLS by design.
-- This migration ASSERTS and DOCUMENTS that posture.

-- Ensure schemas exist
CREATE SCHEMA IF NOT EXISTS secure;
CREATE SCHEMA IF NOT EXISTS audit;

-- Defensive re-assertion: RLS must remain enabled and forced
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

-- NOTE:
-- No GRANT is provided to anon/auth roles.
-- No policy is created here.
-- Service role bypass is ONLY effective via backend execution paths.

COMMIT;
