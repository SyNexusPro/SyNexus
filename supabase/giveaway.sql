-- Synexus Launch Giveaway — entry ledger + RPC helpers
-- Run in Supabase SQL editor after main schema.sql

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.giveaway_participants (
  user_id uuid primary key references auth.users (id) on delete cascade,
  referral_code text not null,
  referred_by uuid references auth.users (id) on delete set null,
  social_claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists giveaway_participants_referral_code_idx
  on public.giveaway_participants (lower(referral_code));

create table if not exists public.giveaway_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_type text not null check (
    entry_type in ('signup', 'profile', 'referral', 'social', 'daily_login')
  ),
  entry_count integer not null default 1 check (entry_count > 0),
  entry_day date,
  related_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists giveaway_entries_signup_once
  on public.giveaway_entries (user_id)
  where entry_type = 'signup';

create unique index if not exists giveaway_entries_profile_once
  on public.giveaway_entries (user_id)
  where entry_type = 'profile';

create unique index if not exists giveaway_entries_social_once
  on public.giveaway_entries (user_id)
  where entry_type = 'social';

create unique index if not exists giveaway_entries_daily_once
  on public.giveaway_entries (user_id, entry_day)
  where entry_type = 'daily_login';

create unique index if not exists giveaway_entries_referral_pair
  on public.giveaway_entries (user_id, related_user_id)
  where entry_type = 'referral';

create index if not exists giveaway_entries_user_idx
  on public.giveaway_entries (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.giveaway_starts_at()
returns timestamptz
language sql
immutable
as $$
  select timestamptz '2026-06-12 00:00:00+00';
$$;

create or replace function public.giveaway_ends_at()
returns timestamptz
language sql
immutable
as $$
  select timestamptz '2026-07-12 23:59:59+00';
$$;

create or replace function public.giveaway_is_active()
returns boolean
language sql
stable
as $$
  select now() >= public.giveaway_starts_at() and now() <= public.giveaway_ends_at();
$$;

create or replace function public.giveaway_profile_complete(p_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and coalesce(length(trim(p.display_name)), 0) >= 2
      and coalesce(length(trim(p.username)), 0) >= 3
      and coalesce(length(trim(p.bio)), 0) >= 10
  );
$$;

create or replace function public.giveaway_email_verified(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = p_user_id
      and u.email_confirmed_at is not null
  );
$$;

create or replace function public.giveaway_ensure_participant(p_user_id uuid)
returns public.giveaway_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.giveaway_participants;
  code text;
  suffix int := 0;
begin
  select * into row from public.giveaway_participants where user_id = p_user_id;
  if found then
    return row;
  end if;

  select coalesce(nullif(trim(p.username), ''), 'operator')
  into code
  from public.profiles p
  where p.id = p_user_id;

  code := lower(regexp_replace(code, '[^a-z0-9_]', '_', 'g'));
  code := regexp_replace(code, '_+', '_', 'g');
  code := trim(both '_' from code);
  if code = '' then
    code := 'operator';
  end if;

  while exists (
    select 1 from public.giveaway_participants gp where lower(gp.referral_code) = lower(code)
  ) loop
    suffix := suffix + 1;
    code := left(code, 24) || '_' || suffix::text;
  end loop;

  insert into public.giveaway_participants (user_id, referral_code)
  values (p_user_id, code)
  returning * into row;

  return row;
end;
$$;

create or replace function public.giveaway_add_entry(
  p_user_id uuid,
  p_entry_type text,
  p_entry_count integer default 1,
  p_entry_day date default null,
  p_related_user_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.giveaway_is_active() then
    return false;
  end if;

  insert into public.giveaway_entries (
    user_id,
    entry_type,
    entry_count,
    entry_day,
    related_user_id
  )
  values (p_user_id, p_entry_type, p_entry_count, p_entry_day, p_related_user_id)
  on conflict do nothing;

  return found;
exception
  when unique_violation then
    return false;
end;
$$;

create or replace function public.giveaway_apply_referral(p_ref_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ref_user uuid;
  cleaned text;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  if not public.giveaway_is_active() then
    return jsonb_build_object('ok', false, 'reason', 'inactive');
  end if;

  cleaned := lower(trim(coalesce(p_ref_code, '')));
  if length(cleaned) < 3 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  perform public.giveaway_ensure_participant(uid);

  if exists (
    select 1 from public.giveaway_participants gp where gp.user_id = uid and gp.referred_by is not null
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_referred');
  end if;

  select gp.user_id
  into ref_user
  from public.giveaway_participants gp
  where lower(gp.referral_code) = cleaned
  limit 1;

  if ref_user is null then
    return jsonb_build_object('ok', false, 'reason', 'code_not_found');
  end if;

  if ref_user = uid then
    return jsonb_build_object('ok', false, 'reason', 'self_referral');
  end if;

  update public.giveaway_participants
  set referred_by = ref_user
  where user_id = uid;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.giveaway_credit_referrer(p_referee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_user uuid;
begin
  if not public.giveaway_is_active() then
    return;
  end if;

  if not public.giveaway_email_verified(p_referee_id) then
    return;
  end if;

  select gp.referred_by into ref_user
  from public.giveaway_participants gp
  where gp.user_id = p_referee_id;

  if ref_user is null then
    return;
  end if;

  perform public.giveaway_add_entry(ref_user, 'referral', 5, null, p_referee_id);
end;
$$;

create or replace function public.giveaway_sync_entries()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (timezone('utc', now()))::date;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  perform public.giveaway_ensure_participant(uid);

  if public.giveaway_is_active() and public.giveaway_email_verified(uid) then
    perform public.giveaway_add_entry(uid, 'signup', 1);
    perform public.giveaway_credit_referrer(uid);
  end if;

  if public.giveaway_is_active()
     and public.giveaway_email_verified(uid)
     and public.giveaway_profile_complete(uid) then
    perform public.giveaway_add_entry(uid, 'profile', 1);
  end if;

  if public.giveaway_is_active()
     and public.giveaway_email_verified(uid) then
    perform public.giveaway_add_entry(uid, 'daily_login', 1, today);
  end if;

  return public.giveaway_get_status();
end;
$$;

create or replace function public.giveaway_claim_social()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  if not public.giveaway_is_active() then
    return jsonb_build_object('ok', false, 'reason', 'inactive');
  end if;

  if not public.giveaway_email_verified(uid) then
    return jsonb_build_object('ok', false, 'reason', 'email_not_verified');
  end if;

  perform public.giveaway_ensure_participant(uid);

  if exists (
    select 1 from public.giveaway_entries ge
    where ge.user_id = uid and ge.entry_type = 'social'
  ) then
    return public.giveaway_get_status();
  end if;

  perform public.giveaway_add_entry(uid, 'social', 2);
  update public.giveaway_participants
  set social_claimed_at = now()
  where user_id = uid;

  return public.giveaway_get_status();
end;
$$;

create or replace function public.giveaway_save_profile(
  p_display_name text,
  p_username text,
  p_bio text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_name text;
  clean_user text;
  clean_bio text;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  clean_name := trim(coalesce(p_display_name, ''));
  clean_user := lower(regexp_replace(trim(coalesce(p_username, '')), '[^a-z0-9_]', '_', 'g'));
  clean_user := regexp_replace(clean_user, '_+', '_', 'g');
  clean_user := trim(both '_' from clean_user);
  clean_bio := trim(coalesce(p_bio, ''));

  if length(clean_name) < 2 then
    return jsonb_build_object('ok', false, 'reason', 'display_name');
  end if;
  if length(clean_user) < 3 or length(clean_user) > 30 then
    return jsonb_build_object('ok', false, 'reason', 'username');
  end if;
  if length(clean_bio) < 10 then
    return jsonb_build_object('ok', false, 'reason', 'bio');
  end if;

  if exists (
    select 1 from public.profiles p
    where p.username = clean_user and p.id <> uid
  ) then
    return jsonb_build_object('ok', false, 'reason', 'username_taken');
  end if;

  insert into public.profiles (id, display_name, username, bio)
  values (uid, clean_name, clean_user, clean_bio)
  on conflict (id) do update
  set display_name = excluded.display_name,
      username = excluded.username,
      bio = excluded.bio,
      updated_at = now();

  perform public.giveaway_ensure_participant(uid);

  if public.giveaway_is_active()
     and public.giveaway_email_verified(uid)
     and public.giveaway_profile_complete(uid) then
    perform public.giveaway_add_entry(uid, 'profile', 1);
  end if;

  return public.giveaway_get_status();
end;
$$;

create or replace function public.giveaway_get_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  participant public.giveaway_participants;
  total int := 0;
  referral_count int := 0;
  profile_done boolean := false;
  email_done boolean := false;
  breakdown jsonb := '[]'::jsonb;
begin
  if uid is null then
    return jsonb_build_object(
      'ok', true,
      'authenticated', false,
      'active', public.giveaway_is_active(),
      'startsAt', public.giveaway_starts_at(),
      'endsAt', public.giveaway_ends_at()
    );
  end if;

  select * into participant from public.giveaway_ensure_participant(uid);
  email_done := public.giveaway_email_verified(uid);
  profile_done := public.giveaway_profile_complete(uid);

  select coalesce(sum(ge.entry_count), 0)
  into total
  from public.giveaway_entries ge
  where ge.user_id = uid;

  select count(*)
  into referral_count
  from public.giveaway_entries ge
  where ge.user_id = uid and ge.entry_type = 'referral';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'type', ge.entry_type,
        'count', ge.entry_count,
        'day', ge.entry_day,
        'createdAt', ge.created_at
      )
      order by ge.created_at desc
    ),
    '[]'::jsonb
  )
  into breakdown
  from public.giveaway_entries ge
  where ge.user_id = uid;

  return jsonb_build_object(
    'ok', true,
    'authenticated', true,
    'active', public.giveaway_is_active(),
    'startsAt', public.giveaway_starts_at(),
    'endsAt', public.giveaway_ends_at(),
    'emailVerified', email_done,
    'profileComplete', profile_done,
    'eligible', email_done and profile_done,
    'totalEntries', total,
    'referralCount', referral_count,
    'referralCode', participant.referral_code,
    'socialClaimed', participant.social_claimed_at is not null,
    'entries', breakdown
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.giveaway_participants enable row level security;
alter table public.giveaway_entries enable row level security;

drop policy if exists "Giveaway participants read own" on public.giveaway_participants;
create policy "Giveaway participants read own"
  on public.giveaway_participants for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Giveaway entries read own" on public.giveaway_entries;
create policy "Giveaway entries read own"
  on public.giveaway_entries for select
  to authenticated
  using (auth.uid() = user_id);

grant execute on function public.giveaway_get_status() to authenticated, anon;
grant execute on function public.giveaway_sync_entries() to authenticated;
grant execute on function public.giveaway_claim_social() to authenticated;
grant execute on function public.giveaway_save_profile(text, text, text) to authenticated;
grant execute on function public.giveaway_apply_referral(text) to authenticated;

comment on table public.giveaway_entries is
  'Launch giveaway entry ledger — writes via security definer RPC only';
