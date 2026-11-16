-- Owner-only Hera Developer proposals and audit log.
-- The API reads this with the server database role. No anon or authenticated policies.

create table if not exists public.hera_developer_proposals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  discovery text not null,
  change_summary text not null,
  why text not null,
  tests_passed text not null default '',
  tests_failed text not null default '',
  benefits text not null,
  risks text not null,
  ready boolean not null default false,
  status text not null default 'proposed' check (
    status in ('proposed', 'approved', 'rejected', 'changes_requested')
  ),
  tested_sha text not null,
  branch_name text not null default '',
  sensitive boolean not null default false,
  rollback text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hera_developer_audit (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.hera_developer_proposals (id),
  action text not null,
  actor_user_id uuid not null,
  tested_sha text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.hera_developer_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  status text not null,
  spend_usd numeric(12, 4) not null default 0,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists hera_developer_proposals_status_idx
  on public.hera_developer_proposals (status, created_at desc);

alter table public.hera_developer_proposals enable row level security;
alter table public.hera_developer_audit enable row level security;
alter table public.hera_developer_runs enable row level security;
