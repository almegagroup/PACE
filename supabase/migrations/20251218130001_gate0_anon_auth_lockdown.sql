-- Gate-0 / ID-0.6E
-- Anon & Auth Role Lockdown (Client Zero-Access)

BEGIN;

-- Revoke all privileges on schemas
REVOKE ALL ON SCHEMA public FROM anon, authenticated;
REVOKE ALL ON SCHEMA secure FROM anon, authenticated;
REVOKE ALL ON SCHEMA audit  FROM anon, authenticated;

-- Revoke all privileges on existing tables, sequences, functions
DO $$
DECLARE
    r RECORD;
BEGIN
    -- public schema
    FOR r IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated;', r.tablename);
    END LOOP;

    -- secure schema
    FOR r IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'secure'
    LOOP
        EXECUTE format('REVOKE ALL ON TABLE secure.%I FROM anon, authenticated;', r.tablename);
    END LOOP;

    -- audit schema
    FOR r IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'audit'
    LOOP
        EXECUTE format('REVOKE ALL ON TABLE audit.%I FROM anon, authenticated;', r.tablename);
    END LOOP;
END;
$$;

-- Revoke default privileges (future-proof)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
REVOKE ALL ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA secure
REVOKE ALL ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA audit
REVOKE ALL ON TABLES FROM anon, authenticated;

COMMIT;
