BEGIN;

-- Add profile columns to auth_users if missing
ALTER TABLE secure.auth_users
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS company_hint TEXT,
  ADD COLUMN IF NOT EXISTS department_hint TEXT,
  ADD COLUMN IF NOT EXISTS designation_hint TEXT;

-- Patch FIRST_LOGIN_COMPLETE RPC
CREATE OR REPLACE FUNCTION public.first_login_complete(
  p_phone                     text,
  p_new_passcode              text,
  p_new_password              text,
  p_identifier_hash           text,
  p_secondary_identifier_hash text DEFAULT NULL,
  p_request_id                text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, secure, audit, extensions
AS $$
DECLARE
  v_user_id   uuid;
  v_signup_id uuid;
  v_profile   record;
BEGIN
  -- (unchanged validation part...)

  SELECT id
    INTO v_user_id
  FROM secure.auth_users
  WHERE identifier = trim(p_phone) || '@pace.in'
    AND state = 'FIRST_LOGIN_REQUIRED'
  LIMIT 1
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT *
    INTO v_profile
  FROM public.auth_signup_requests
  WHERE phone = trim(p_phone)
    AND state = 'SET_FIRST_LOGIN'
  LIMIT 1
  FOR UPDATE;

  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  -- Rotate credentials (unchanged)

  -- ✅ PATCH: propagate profile data
  UPDATE secure.auth_users
     SET state            = 'ACTIVE',
         phone            = trim(p_phone),
         name             = v_profile.name,
         company_hint     = v_profile.company_hint,
         department_hint  = v_profile.department_hint,
         designation_hint = v_profile.designation_hint,
         is_active        = true,
         updated_at       = now()
   WHERE id = v_user_id;

  -- Consume signup request (unchanged)
  UPDATE public.auth_signup_requests
     SET state = 'CONSUMED',
         consumed_at = now(),
         consumed_by = 'FIRST_LOGIN'
   WHERE id = v_profile.id;

  -- Audit success (unchanged)

  RETURN jsonb_build_object('ok', true, 'flow', 'SIGNUP');
END;
$$;

COMMIT;
