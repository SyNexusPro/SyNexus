-- SyNexus site analytics — page views, auth events, token views
-- Run in Supabase SQL editor after main schema.

create table if not exists public.site_analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (
    event_type in (
      'page_view',
      'sign_in',
      'sign_up',
      'sign_out',
      'magic_link_sent',
      'password_reset_requested',
      'verification_email_resent',
      'biometric_sign_in',
      'token_view'
    )
  ),
  path text not null default '/',
  visitor_id text not null,
  user_id uuid references auth.users (id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists site_analytics_events_created_at_idx
  on public.site_analytics_events (created_at desc);

create index if not exists site_analytics_events_type_created_idx
  on public.site_analytics_events (event_type, created_at desc);

create index if not exists site_analytics_events_visitor_idx
  on public.site_analytics_events (visitor_id, created_at desc);

create index if not exists site_analytics_events_path_idx
  on public.site_analytics_events (path, created_at desc);

alter table public.site_analytics_events enable row level security;

drop policy if exists "Public insert analytics events" on public.site_analytics_events;
create policy "Public insert analytics events"
  on public.site_analytics_events for insert
  to anon, authenticated
  with check (user_id is null or auth.uid() = user_id);

comment on table public.site_analytics_events is
  'SyNexus client analytics — inserts only from app; reads via service role / owner API';
