-- Synexus Aegis — security event log (optional server-side audit trail)
-- Run in Supabase SQL editor after main schema.

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  event_type text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  action text,
  message text not null,
  detail jsonb default '{}'::jsonb,
  client_fingerprint text,
  blocked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists security_events_created_at_idx on public.security_events (created_at desc);
create index if not exists security_events_user_id_idx on public.security_events (user_id);
create index if not exists security_events_fingerprint_idx on public.security_events (client_fingerprint);

alter table public.security_events enable row level security;

drop policy if exists "Users insert own security events" on public.security_events;
create policy "Users insert own security events"
  on public.security_events for insert
  to authenticated
  with check (auth.uid() = user_id or user_id is null);

drop policy if exists "Users read own security events" on public.security_events;
create policy "Users read own security events"
  on public.security_events for select
  to authenticated
  using (auth.uid() = user_id);

comment on table public.security_events is 'Synexus Aegis — client-reported abuse and block events';
