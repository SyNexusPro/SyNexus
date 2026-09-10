-- Invite & Earn: 3 verified signups (card + identity) unlock 30 days of Pro Titan.
-- One reward per referrer. Each referee can only be attributed once.
-- Run in Supabase SQL Editor. Safe to re-run.

alter table public.profiles
  add column if not exists referral_code text;
alter table public.profiles
  add column if not exists referred_by uuid;
alter table public.profiles
  add column if not exists identity_status text not null default 'pending';
alter table public.profiles
  add column if not exists identity_verified_at timestamptz;
alter table public.profiles
  add column if not exists identity_full_name text;
alter table public.profiles
  add column if not exists identity_country text;
alter table public.profiles
  add column if not exists identity_fingerprint text;
alter table public.profiles
  add column if not exists card_verified boolean not null default false;
alter table public.profiles
  add column if not exists card_verified_at timestamptz;
alter table public.profiles
  add column if not exists card_fingerprint text;
alter table public.profiles
  add column if not exists card_last4 text;
alter table public.profiles
  add column if not exists card_brand text;
alter table public.profiles
  add column if not exists invite_reward_claimed boolean not null default false;
alter table public.profiles
  add column if not exists invite_reward_until timestamptz;

create unique index if not exists profiles_referral_code_uidx
  on public.profiles (referral_code)
  where referral_code is not null;

create unique index if not exists profiles_identity_fingerprint_uidx
  on public.profiles (identity_fingerprint)
  where identity_fingerprint is not null;

create unique index if not exists profiles_card_fingerprint_uidx
  on public.profiles (card_fingerprint)
  where card_fingerprint is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_referred_by_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_referred_by_fkey
      foreign key (referred_by) references public.profiles (id) on delete set null;
  end if;
end $$;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'qualified', 'rejected')),
  created_at timestamptz not null default now(),
  qualified_at timestamptz,
  unique (referee_id)
);

create index if not exists referrals_referrer_status_idx
  on public.referrals (referrer_id, status);

alter table public.referrals enable row level security;

drop policy if exists "referrals_select_own" on public.referrals;
create policy "referrals_select_own"
  on public.referrals for select
  using (auth.uid() = referrer_id or auth.uid() = referee_id);

comment on table public.referrals is 'Invite & Earn attributions. Referee is unique (one referrer per customer).';
comment on column public.profiles.invite_reward_claimed is 'True after the one-time 30-day Pro Titan reward is granted.';
