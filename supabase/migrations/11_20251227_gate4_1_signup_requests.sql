create table if not exists auth_signup_requests (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  email text not null,
  phone text not null,

  company_hint text,
  department_hint text,
  designation_hint text,

  state text not null default 'REQUESTED'
    check (state in (
      'REQUESTED',
      'REJECTED',
      'APPROVED_SETUP_PENDING'
    )),

  requested_at timestamptz not null default now(),

  reviewed_by uuid,
  reviewed_at timestamptz,
  review_reason text,

  constraint uq_signup_email unique (email),
  constraint uq_signup_phone unique (phone)
);
