-- Social access follows the server membership tier.
-- Clients cannot grant themselves PRO. The service connection can.

-- Staff helper used by community_has_entitlement (safe if community foundation is partial).
create table if not exists public.community_staff (
  user_id uuid primary key
);

alter table public.community_staff enable row level security;
revoke all on table public.community_staff from anon;
revoke all on table public.community_staff from authenticated;
grant select on table public.community_staff to authenticated;

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

alter table public.profiles
  add column if not exists membership_tier text not null default 'free';

alter table public.profiles
  drop constraint if exists profiles_membership_tier_check;

alter table public.profiles
  add constraint profiles_membership_tier_check
  check (membership_tier in ('free', 'next_level', 'pantheon'));

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

drop trigger if exists protect_membership_columns on public.profiles;
create trigger protect_membership_columns
  before insert or update on public.profiles
  for each row
  execute function public.protect_membership_columns();

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
