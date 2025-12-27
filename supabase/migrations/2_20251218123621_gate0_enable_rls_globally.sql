-- Gate-0 / ID-0.6B
-- Enable RLS globally (default deny posture)

BEGIN;

-- Safety: ensure schemas exist
CREATE SCHEMA IF NOT EXISTS secure;
CREATE SCHEMA IF NOT EXISTS audit;

-- Enable RLS on all existing tables in secure schema
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'secure'
    LOOP
        EXECUTE format('ALTER TABLE secure.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
        EXECUTE format('ALTER TABLE secure.%I FORCE ROW LEVEL SECURITY;', r.tablename);
    END LOOP;
END;
$$;

-- Enable RLS on all existing tables in audit schema
DO $$
DECLARE
    r RECORD;
BEGIN
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

COMMIT;
