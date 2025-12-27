-- ============================================================================
-- Migration : Gate-3.8 Session Timeline Logs
-- Purpose   : RCA-ready session lifecycle observability
-- Scope     : NON-BLOCKING, append-only
-- Depends   : Gate-3 core session model
-- ============================================================================
-- Gate-3.8 :: Session Timeline Logs (Observability)
create table if not exists erp_session_timeline (
  id bigint generated always as identity primary key,
  session_id text not null,
  user_id text,
  from_state text,
  to_state text not null,
  event text not null,
  request_id text,
  source text,
  created_at timestamptz default now()
);

create index if not exists idx_session_timeline_session
  on erp_session_timeline (session_id);

create index if not exists idx_session_timeline_request
  on erp_session_timeline (request_id);

create index if not exists idx_session_timeline_created
  on erp_session_timeline (created_at);
