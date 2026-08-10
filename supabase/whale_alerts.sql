-- SyNexus whale-buy alerts (Pro) + push subscriptions
-- Run in Supabase SQL Editor (safe to re-run).

create table if not exists public.whale_events (
  id uuid primary key default gen_random_uuid(),
  mint text not null,
  symbol text,
  side text not null default 'buy' check (side in ('buy', 'sell')),
  usd_amount double precision not null,
  wallet text,
  tx_signature text,
  source text not null default 'helius',
  detected_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

create unique index if not exists whale_events_tx_uidx
  on public.whale_events (tx_signature)
  where tx_signature is not null;

create index if not exists whale_events_detected_idx
  on public.whale_events (detected_at desc);

create index if not exists whale_events_mint_idx
  on public.whale_events (mint);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  platform text not null default 'web' check (platform in ('web', 'android', 'ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create table if not exists public.whale_alert_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default true,
  min_usd double precision not null default 10000,
  watch_mints text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.whale_events enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.whale_alert_prefs enable row level security;

drop policy if exists whale_events_pro_read on public.whale_events;
create policy whale_events_pro_read on public.whale_events
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.paid_plan = 'PRO'
    )
  );

drop policy if exists push_subs_own on public.push_subscriptions;
create policy push_subs_own on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists whale_prefs_own on public.whale_alert_prefs;
create policy whale_prefs_own on public.whale_alert_prefs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table public.whale_events is 'Large swap detections for Pro Leviathan / Titan alerts';
comment on table public.push_subscriptions is 'Web Push endpoints for Pro whale alerts';
