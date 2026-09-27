-- SyNexus Community Phase 1: disabled-by-default security foundation.
-- This migration is additive. It does not alter existing auth, profile, plan,
-- market, payment, or security tables.

create extension if not exists "pgcrypto";

create table public.community_settings (
  id boolean primary key default true check (id = true),
  enabled boolean not null default false,
  guidelines_version integer not null default 1 check (guidelines_version > 0),
  guidelines_url text not null default '/terms',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.community_settings (id, enabled)
values (true, false)
on conflict (id) do nothing;

create table public.community_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  guidelines_version integer,
  guidelines_accepted_at timestamptz,
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (guidelines_version is null and guidelines_accepted_at is null)
    or (guidelines_version is not null and guidelines_accepted_at is not null)
  )
);

create table public.community_staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('moderator', 'admin')),
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 60),
  description text not null default '' check (char_length(description) <= 500),
  icon text,
  rules jsonb not null default '[]'::jsonb check (jsonb_typeof(rules) = 'array'),
  status text not null default 'active' check (status in ('active', 'archived')),
  sort_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'moderator', 'admin')),
  status text not null default 'active' check (status in ('active', 'muted', 'removed')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create table public.user_trust_scores (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state text not null default 'normal'
    check (state in ('trusted', 'normal', 'watch', 'limited', 'quarantined', 'suspended', 'banned')),
  risk_score integer not null default 0 check (risk_score between 0 and 100),
  reputation_score integer not null default 0 check (reputation_score between 0 and 100),
  reason_codes text[] not null default '{}',
  restricted_until timestamptz,
  last_evaluated_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.moderation_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique check (rule_key ~ '^[a-z0-9_]+$'),
  category text not null,
  description text not null,
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  enabled boolean not null default true,
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.community_security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  actor_id uuid references auth.users (id) on delete set null,
  event_type text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  decision text not null check (decision in ('allow', 'watch', 'limit', 'quarantine', 'suspend', 'ban')),
  reason_codes text[] not null default '{}',
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create index community_members_user_idx
  on public.community_members (user_id, status, joined_at desc);
create index community_members_room_idx
  on public.community_members (community_id, status, joined_at desc);
create index communities_status_sort_idx
  on public.communities (status, sort_order, name);
create index user_trust_state_idx
  on public.user_trust_scores (state, risk_score desc, updated_at desc);
create index moderation_rules_active_idx
  on public.moderation_rules (enabled, category);
create index community_security_events_queue_idx
  on public.community_security_events (decision, severity, created_at desc);
create index community_security_events_user_idx
  on public.community_security_events (user_id, created_at desc);

create trigger set_community_settings_updated_at
  before update on public.community_settings
  for each row execute function public.set_updated_at();
create trigger set_community_profiles_updated_at
  before update on public.community_profiles
  for each row execute function public.set_updated_at();
create trigger set_communities_updated_at
  before update on public.communities
  for each row execute function public.set_updated_at();
create trigger set_community_members_updated_at
  before update on public.community_members
  for each row execute function public.set_updated_at();
create trigger set_user_trust_scores_updated_at
  before update on public.user_trust_scores
  for each row execute function public.set_updated_at();
create trigger set_moderation_rules_updated_at
  before update on public.moderation_rules
  for each row execute function public.set_updated_at();

create or replace function public.community_feature_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select enabled from public.community_settings where id = true),
    false
  );
$$;

create or replace function public.community_is_staff(target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
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
set search_path = public
as $$
  select target_user is not null and (
    public.community_is_staff(target_user)
    or exists (
      select 1 from public.profiles
      where id = target_user and paid_plan = 'PRO'
    )
  );
$$;

create or replace function public.community_is_admin(target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_user is not null and exists (
    select 1 from public.community_staff
    where user_id = target_user and role = 'admin'
  );
$$;

create or replace function public.community_can_access(target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.community_feature_enabled()
    and public.community_has_entitlement(target_user)
    and not exists (
      select 1
      from public.user_trust_scores
      where user_id = target_user
        and (
          state in ('suspended', 'banned')
          or (
            state = 'quarantined'
            and restricted_until is not null
            and restricted_until > now()
          )
        )
    );
$$;

create or replace function public.community_can_publish(target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.community_can_access(target_user)
    and exists (
      select 1
      from public.community_profiles cp
      join public.community_settings cs on cs.id = true
      where cp.user_id = target_user
        and cp.guidelines_accepted_at is not null
        and cp.guidelines_version = cs.guidelines_version
    )
    and not exists (
      select 1 from public.user_trust_scores
      where user_id = target_user
        and state in ('limited', 'quarantined', 'suspended', 'banned')
    );
$$;

revoke all on function public.community_feature_enabled() from public;
revoke all on function public.community_is_staff(uuid) from public;
revoke all on function public.community_is_admin(uuid) from public;
revoke all on function public.community_has_entitlement(uuid) from public;
revoke all on function public.community_can_access(uuid) from public;
revoke all on function public.community_can_publish(uuid) from public;
grant execute on function public.community_feature_enabled() to authenticated;
grant execute on function public.community_is_staff(uuid) to authenticated;
grant execute on function public.community_is_admin(uuid) to authenticated;
grant execute on function public.community_has_entitlement(uuid) to authenticated;
grant execute on function public.community_can_access(uuid) to authenticated;
grant execute on function public.community_can_publish(uuid) to authenticated;

alter table public.community_settings enable row level security;
alter table public.community_profiles enable row level security;
alter table public.community_staff enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.user_trust_scores enable row level security;
alter table public.moderation_rules enable row level security;
alter table public.community_security_events enable row level security;

create policy community_settings_read
  on public.community_settings for select to authenticated
  using (public.community_can_access() or public.community_is_staff());
create policy community_settings_admin_update
  on public.community_settings for update to authenticated
  using (public.community_is_staff())
  with check (public.community_is_staff());

create policy community_profiles_read
  on public.community_profiles for select to authenticated
  using (public.community_can_access());
create policy community_profiles_insert_self
  on public.community_profiles for insert to authenticated
  with check (auth.uid() = user_id and public.community_can_access());
create policy community_profiles_update_self
  on public.community_profiles for update to authenticated
  using (auth.uid() = user_id and public.community_can_access())
  with check (auth.uid() = user_id and public.community_can_access());

create policy community_staff_read
  on public.community_staff for select to authenticated
  using (public.community_can_access());
create policy community_staff_admin_insert
  on public.community_staff for insert to authenticated
  with check (public.community_is_admin());
create policy community_staff_admin_update
  on public.community_staff for update to authenticated
  using (public.community_is_admin())
  with check (public.community_is_admin());
create policy community_staff_admin_delete
  on public.community_staff for delete to authenticated
  using (public.community_is_admin() and user_id <> auth.uid());

create policy communities_read
  on public.communities for select to authenticated
  using (public.community_can_access() and (status = 'active' or public.community_is_staff()));
create policy communities_staff_insert
  on public.communities for insert to authenticated
  with check (public.community_is_staff());
create policy communities_staff_update
  on public.communities for update to authenticated
  using (public.community_is_staff())
  with check (public.community_is_staff());
create policy communities_staff_delete
  on public.communities for delete to authenticated
  using (public.community_is_staff());

create policy community_members_read
  on public.community_members for select to authenticated
  using (public.community_can_access());
create policy community_members_join_self
  on public.community_members for insert to authenticated
  with check (
    auth.uid() = user_id
    and role = 'member'
    and status = 'active'
    and public.community_can_access()
    and exists (
      select 1 from public.communities
      where id = community_id and status = 'active'
    )
  );
create policy community_members_leave_self
  on public.community_members for delete to authenticated
  using (auth.uid() = user_id or public.community_is_staff());
create policy community_members_staff_update
  on public.community_members for update to authenticated
  using (public.community_is_staff())
  with check (public.community_is_staff());

create policy user_trust_scores_read_self_or_staff
  on public.user_trust_scores for select to authenticated
  using (auth.uid() = user_id or public.community_is_staff());

create policy moderation_rules_read_active
  on public.moderation_rules for select to authenticated
  using (public.community_can_access() and (enabled or public.community_is_staff()));
create policy moderation_rules_staff_insert
  on public.moderation_rules for insert to authenticated
  with check (public.community_is_staff());
create policy moderation_rules_staff_update
  on public.moderation_rules for update to authenticated
  using (public.community_is_staff())
  with check (public.community_is_staff());
create policy moderation_rules_staff_delete
  on public.moderation_rules for delete to authenticated
  using (public.community_is_staff());

create policy community_security_events_staff_read
  on public.community_security_events for select to authenticated
  using (public.community_is_staff());

insert into public.communities (slug, name, description, icon, sort_order)
values
  ('bitcoin', 'Bitcoin', 'Bitcoin markets, protocol, adoption and ecosystem discussion.', '₿', 10),
  ('solana', 'Solana', 'Solana ecosystem, applications, validators and market discussion.', '◎', 20),
  ('altcoins', 'Altcoins', 'Research and discussion for crypto assets beyond Bitcoin.', '◇', 30),
  ('trading', 'Trading', 'Market structure, strategy, risk management and trade discussion.', '⇄', 40),
  ('scam-alerts', 'Scam Alerts', 'Member reports and Sentinel-reviewed security warnings.', '⚠', 50),
  ('breaking-news', 'Breaking News', 'Time-sensitive crypto, markets and technology news.', '◉', 60),
  ('ai-technology', 'AI & Technology', 'Artificial intelligence, software and emerging technology.', '✦', 70),
  ('new-projects', 'New Projects', 'Early project discovery with strict disclosure and safety rules.', '△', 80),
  ('general-discussion', 'General Discussion', 'Member conversation that does not fit another room.', '☰', 90)
on conflict (slug) do nothing;

insert into public.moderation_rules (rule_key, category, description, config, severity)
values
  ('suspicious_urls', 'links', 'Queue suspicious, shortened or known malicious URLs for review.', '{"action":"queue","scan_required":true}', 'high'),
  ('duplicate_spam', 'spam', 'Detect repeated or substantially duplicate posts and comments.', '{"action":"score","window_minutes":60}', 'medium'),
  ('mass_actions', 'abuse', 'Detect high-frequency posting, commenting, following and reporting.', '{"action":"rate_limit"}', 'high'),
  ('impersonation', 'identity', 'Review attempts to impersonate staff, creators or projects.', '{"action":"queue"}', 'high'),
  ('crypto_promotion', 'crypto', 'Score repeated token, wallet, contract and referral promotion.', '{"action":"score","scan_required":true}', 'medium')
on conflict (rule_key) do nothing;

comment on table public.community_settings is
  'Authoritative database feature gate. Remains disabled until launch.';
comment on table public.community_profiles is
  'Community-only member preferences and guidelines acceptance; public identity remains in profiles.';
comment on table public.community_security_events is
  'Append-only Sentinel audit evidence. No authenticated client insert/update/delete policy.';
