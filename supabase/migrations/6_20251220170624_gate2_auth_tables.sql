-- Gate-2: Auth tables (users + sessions)
-- File: supabase/migrations/20251220090000_gate2_auth_tables.sql

create extension if not exists pgcrypto;

create schema if not exists secure;

-- -----------------------------
-- secure.auth_users
-- -----------------------------
create table if not exists secure.auth_users (
  id uuid primary key default gen_random_uuid(),
  identifier text not null unique,
  password_hash text not null,
  state text not null default 'ACTIVE' check (state in ('ACTIVE', 'DISABLED', 'LOCKED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------
-- secure.auth_sessions
-- -----------------------------
create table if not exists secure.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references secure.auth_users(id) on delete cascade,
  session_token text not null unique,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'REVOKED', 'EXPIRED')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  last_seen_at timestamptz null
);

create index if not exists idx_auth_sessions_user_id on secure.auth_sessions(user_id);
create index if not exists idx_auth_sessions_expires_at on secure.auth_sessions(expires_at);

-- -----------------------------
-- RLS hardening (Gate-0 rules apply globally, but we still enforce explicitly)
-- -----------------------------
alter table secure.auth_users enable row level security;
alter table secure.auth_users force row level security;

alter table secure.auth_sessions enable row level security;
alter table secure.auth_sessions force row level security;

-- NOTE:
-- No policies intentionally.
-- With RLS enabled and no policies, anon/authenticated cannot access.
-- Service role can bypass (per Gate-0 service role policy).
