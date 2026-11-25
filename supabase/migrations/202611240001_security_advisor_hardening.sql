-- Harden against Supabase Security Advisor findings:
-- 1) community_staff had no RLS (open to anon/authenticated grants)
-- 2) Client grants on service-only tables
-- 3) Missing user policies on watchlists / scans / reports / etc.
-- 4) Mutable function search_path on app-owned functions
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- community_staff: RLS + least privilege
-- ---------------------------------------------------------------------------
alter table public.community_staff enable row level security;

revoke all on table public.community_staff from anon;
revoke all on table public.community_staff from authenticated;
grant select on table public.community_staff to authenticated;

drop policy if exists community_staff_read on public.community_staff;
drop policy if exists community_staff_admin_insert on public.community_staff;
drop policy if exists community_staff_admin_update on public.community_staff;
drop policy if exists community_staff_admin_delete on public.community_staff;
drop policy if exists community_staff_select_authenticated on public.community_staff;

-- Staff ids are not a secret roster for entitlement checks, but writes stay service-only.
create policy community_staff_select_authenticated
  on public.community_staff for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Service-only tables: revoke client grants (RLS already on; service_role bypasses)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'alexus_reports',
    'hera_memory',
    'hera_developer_audit',
    'hera_developer_proposals',
    'hera_developer_runs',
    'hera_mind_audit',
    'hera_mind_consent',
    'hera_personal_memory',
    'hera_shared_lessons',
    'membership_accounts',
    'membership_webhook_events',
    'owner_hera_audit',
    'owner_hera_direct'
  ]
  loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('revoke all on table public.%I from anon', t);
      execute format('revoke all on table public.%I from authenticated', t);
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- User-facing tables: restore own-row policies
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
revoke all on table public.profiles from anon;
grant select, insert, update on table public.profiles to authenticated;

drop policy if exists "profiles own select" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "Profiles readable by everyone" on public.profiles;
drop policy if exists "Users manage own profile" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

alter table public.watchlists enable row level security;
revoke all on table public.watchlists from anon;
grant select, insert, update, delete on table public.watchlists to authenticated;

drop policy if exists "watchlists_all_own" on public.watchlists;
drop policy if exists "Users manage own watchlists" on public.watchlists;
create policy "watchlists_all_own"
  on public.watchlists for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.watchlist_tokens enable row level security;
revoke all on table public.watchlist_tokens from anon;
grant select, insert, delete on table public.watchlist_tokens to authenticated;

drop policy if exists "watchlist_tokens_select_own" on public.watchlist_tokens;
drop policy if exists "watchlist_tokens_insert_own" on public.watchlist_tokens;
drop policy if exists "watchlist_tokens_delete_own" on public.watchlist_tokens;

-- Nested ownership when watchlist_id exists; fall back to user_id column if present.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'watchlist_tokens' and column_name = 'watchlist_id'
  ) then
    execute $pol$
      create policy "watchlist_tokens_select_own"
        on public.watchlist_tokens for select to authenticated
        using (
          exists (
            select 1 from public.watchlists w
            where w.id = watchlist_tokens.watchlist_id and w.user_id = auth.uid()
          )
        )
    $pol$;
    execute $pol$
      create policy "watchlist_tokens_insert_own"
        on public.watchlist_tokens for insert to authenticated
        with check (
          exists (
            select 1 from public.watchlists w
            where w.id = watchlist_id and w.user_id = auth.uid()
          )
        )
    $pol$;
    execute $pol$
      create policy "watchlist_tokens_delete_own"
        on public.watchlist_tokens for delete to authenticated
        using (
          exists (
            select 1 from public.watchlists w
            where w.id = watchlist_id and w.user_id = auth.uid()
          )
        )
    $pol$;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'watchlist_tokens' and column_name = 'user_id'
  ) then
    execute $pol$
      create policy "watchlist_tokens_select_own"
        on public.watchlist_tokens for select to authenticated
        using (auth.uid() = user_id)
    $pol$;
    execute $pol$
      create policy "watchlist_tokens_insert_own"
        on public.watchlist_tokens for insert to authenticated
        with check (auth.uid() = user_id)
    $pol$;
    execute $pol$
      create policy "watchlist_tokens_delete_own"
        on public.watchlist_tokens for delete to authenticated
        using (auth.uid() = user_id)
    $pol$;
  end if;
end $$;

alter table public.guardian_alerts enable row level security;
revoke all on table public.guardian_alerts from anon;
grant select on table public.guardian_alerts to authenticated;
drop policy if exists "guardian_alerts_select_signed_in" on public.guardian_alerts;
drop policy if exists "Guardian alerts visible to authenticated users" on public.guardian_alerts;
create policy "guardian_alerts_select_signed_in"
  on public.guardian_alerts for select to authenticated
  using (auth.uid() is not null);

alter table public.scans enable row level security;
revoke all on table public.scans from anon;
grant select, insert on table public.scans to authenticated;
drop policy if exists "scans_own" on public.scans;
create policy "scans_own"
  on public.scans for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.reports enable row level security;
revoke all on table public.reports from anon;
grant select, insert on table public.reports to authenticated;
drop policy if exists "reports_own" on public.reports;
create policy "reports_own"
  on public.reports for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from anon;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;
drop policy if exists push_subs_own on public.push_subscriptions;
create policy push_subs_own
  on public.push_subscriptions for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Functions: pin search_path (Security Advisor 0011)
-- ---------------------------------------------------------------------------
create or replace function public.match_hera_memory(
  query_embedding vector(1536),
  match_count integer,
  filter_kind text default null
)
returns table (
  id uuid,
  kind text,
  source text,
  content text,
  similarity float
)
language sql
stable
set search_path = ''
as $$
  select
    m.id,
    m.kind,
    m.source,
    m.content,
    1 - (m.embedding operator(public.<=>) query_embedding) as similarity
  from public.hera_memory m
  where m.embedding is not null
    and (filter_kind is null or m.kind = filter_kind)
  order by m.embedding operator(public.<=>) query_embedding
  limit greatest(1, least(match_count, 8));
$$;

revoke all on function public.match_hera_memory(vector, integer, text) from public, anon, authenticated;

create or replace function public.protect_membership_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') in ('', 'service_role') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.paid_plan := 'FREE';
    new.membership_tier := 'free';
    return new;
  end if;
  new.paid_plan := old.paid_plan;
  new.membership_tier := old.membership_tier;
  return new;
end;
$$;

create or replace function public.community_is_staff(target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user is not null and exists (
    select 1 from public.community_staff
    where user_id = target_user
  );
$$;

create or replace function public.community_has_entitlement(target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user is not null and (
    public.community_is_staff(target_user)
    or exists (
      select 1 from public.profiles
      where id = target_user
        and membership_tier = 'pantheon'
    )
  );
$$;

-- Prefer empty search_path on remaining app helpers if they exist.
do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    execute $fn$
      create or replace function public.set_updated_at()
      returns trigger
      language plpgsql
      security invoker
      set search_path = ''
      as $body$
      begin
        new.updated_at = now();
        return new;
      end;
      $body$
    $fn$;
  end if;
end $$;


-- Explicit deny policies so Security Advisor does not flag "RLS enabled, no policy"
-- on service-role-only tables (clients already revoked).
do $$
declare
  t text;
begin
  foreach t in array array[
    'alexus_reports',
    'hera_memory',
    'hera_developer_audit',
    'hera_developer_proposals',
    'hera_developer_runs',
    'hera_mind_audit',
    'hera_mind_consent',
    'hera_personal_memory',
    'hera_shared_lessons',
    'membership_accounts',
    'membership_webhook_events',
    'owner_hera_audit',
    'owner_hera_direct'
  ]
  loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('drop policy if exists service_role_only_no_client on public.%I', t);
      execute format(
        'create policy service_role_only_no_client on public.%I for all to anon, authenticated using (false) with check (false)',
        t
      );
    end if;
  end loop;
end $$;
