-- Titan intelligence engine tables + premium alert profile columns
-- Run in Supabase SQL Editor (safe to re-run). Does NOT recreate profiles.

-- Premium alert prefs (paid users: subscription_status = 'active')
alter table public.profiles
  add column if not exists email text;

alter table public.profiles
  add column if not exists subscription_status text not null default 'free';

alter table public.profiles
  add column if not exists notifications_enabled boolean not null default true;

alter table public.profiles
  add column if not exists instant_alerts boolean not null default true;

alter table public.profiles
  add column if not exists daily_digest boolean not null default true;

-- Keep subscription_status in sync with existing paid_plan
update public.profiles
set subscription_status = 'active'
where paid_plan = 'PRO'
  and coalesce(subscription_status, 'free') <> 'active';

update public.profiles
set subscription_status = 'free'
where coalesce(paid_plan, 'FREE') <> 'PRO'
  and coalesce(subscription_status, 'free') = 'active'
  and coalesce(subscription_status, 'free') not in ('canceled', 'past_due');

create table if not exists public.titan_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  summary text,
  severity text not null default 'normal'
    check (severity in ('low', 'normal', 'high', 'critical')),
  symbol text,
  token_address text,
  price numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.titan_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid references public.titan_events (id) on delete set null,
  title text not null,
  message text not null,
  priority text not null default 'normal',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- push_subscriptions may already exist from whale_alerts.sql — ensure endpoint uniqueness
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  platform text not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists push_subscriptions_endpoint_uidx
  on public.push_subscriptions (endpoint);

create index if not exists titan_events_created_idx
  on public.titan_events (created_at desc);

create index if not exists titan_notifications_user_idx
  on public.titan_notifications (user_id, created_at desc);

create index if not exists profiles_subscription_status_idx
  on public.profiles (subscription_status)
  where subscription_status = 'active';

alter table public.titan_events enable row level security;
alter table public.titan_notifications enable row level security;

drop policy if exists titan_events_pro_read on public.titan_events;
create policy titan_events_pro_read on public.titan_events
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (
          p.paid_plan = 'PRO'
          or p.subscription_status = 'active'
        )
    )
  );

drop policy if exists titan_notifications_own on public.titan_notifications;
create policy titan_notifications_own on public.titan_notifications
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Realtime for live in-app alerts (ignore if already added)
do $$
begin
  alter publication supabase_realtime add table public.titan_notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

comment on table public.titan_events is 'Titan intelligence events (whale buys, security, market shocks)';
comment on table public.titan_notifications is 'Per-user Titan alerts for active subscribers';
comment on column public.profiles.subscription_status is 'free | active | canceled | past_due — active receives premium Titan alerts';
