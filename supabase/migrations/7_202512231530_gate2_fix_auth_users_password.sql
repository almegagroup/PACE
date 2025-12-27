-- Gate-2 Corrective Migration
-- Purpose: Align auth_users with SSOT (password handled by Supabase Auth)

BEGIN;

-- 1️⃣ Drop password_hash constraint
ALTER TABLE secure.auth_users
DROP COLUMN IF EXISTS password_hash;

COMMIT;
