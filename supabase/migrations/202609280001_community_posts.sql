-- SyNexus Community Phase 2: member feed (posts, likes, bookmarks).
-- Additive only. Depends on 202609270001_community_foundation.sql.
-- Reads are limited to community members; writes require accepted guidelines
-- (community_can_publish). Author identity is copied from profiles by a
-- security-definer trigger so other members' private profile rows stay unreadable.

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  community_id uuid references public.communities (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  tags text[] not null default '{}' check (cardinality(tags) <= 5),
  author_name text not null default 'Member',
  author_handle text,
  author_avatar text,
  like_count integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  status text not null default 'published' check (status in ('published', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.community_post_likes (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.community_bookmarks (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index community_posts_feed_idx on public.community_posts (status, created_at desc);
create index community_posts_room_idx on public.community_posts (community_id, status, created_at desc);
create index community_posts_author_idx on public.community_posts (author_id, created_at desc);
create index community_post_likes_user_idx on public.community_post_likes (user_id, created_at desc);
create index community_bookmarks_user_idx on public.community_bookmarks (user_id, created_at desc);

create trigger set_community_posts_updated_at
  before update on public.community_posts
  for each row execute function public.set_updated_at();

create or replace function public.community_prepare_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prof record;
  recent integer;
begin
  new.author_id := auth.uid();
  if new.author_id is null then
    raise exception 'authentication required';
  end if;

  if new.body ~* '(seed|recovery|secret)\s*phrase|private\s*key|\m(send|dm)\s+me\s+your\s+(wallet|keys?)' then
    raise exception 'Posts cannot ask for or share wallet secrets.' using errcode = 'check_violation';
  end if;

  select count(*) into recent
  from public.community_posts
  where author_id = new.author_id and created_at > now() - interval '10 minutes';
  if recent >= 5 then
    raise exception 'Slow down — try posting again in a few minutes.' using errcode = 'check_violation';
  end if;

  select username, display_name, avatar_url into prof
  from public.profiles where id = new.author_id;

  new.body := btrim(new.body);
  new.author_name := coalesce(nullif(btrim(prof.display_name), ''), nullif(btrim(prof.username), ''), 'Member');
  new.author_handle := nullif(btrim(prof.username), '');
  new.author_avatar := prof.avatar_url;
  new.like_count := 0;
  new.comment_count := 0;
  new.status := 'published';
  new.created_at := now();
  return new;
end;
$$;

create trigger community_prepare_post
  before insert on public.community_posts
  for each row execute function public.community_prepare_post();

create or replace function public.community_sync_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.community_posts set like_count = like_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.community_posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger community_sync_like_count
  after insert or delete on public.community_post_likes
  for each row execute function public.community_sync_like_count();

create or replace function public.community_member_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.community_can_access() then (
      select count(*)::integer from public.profiles where paid_plan = 'PRO'
    ) + (
      select count(*)::integer from public.community_staff s
      where not exists (select 1 from public.profiles p where p.id = s.user_id and p.paid_plan = 'PRO')
    )
    else 0
  end;
$$;

revoke all on function public.community_prepare_post() from public;
revoke all on function public.community_sync_like_count() from public;
revoke all on function public.community_member_count() from public;
grant execute on function public.community_member_count() to authenticated;

alter table public.community_posts enable row level security;
alter table public.community_post_likes enable row level security;
alter table public.community_bookmarks enable row level security;

create policy community_posts_read
  on public.community_posts for select to authenticated
  using (
    public.community_can_access()
    and (status = 'published' or author_id = auth.uid() or public.community_is_staff())
  );
create policy community_posts_insert_member
  on public.community_posts for insert to authenticated
  with check (author_id = auth.uid() and public.community_can_publish());
create policy community_posts_staff_update
  on public.community_posts for update to authenticated
  using (public.community_is_staff())
  with check (public.community_is_staff());
create policy community_posts_delete_own_or_staff
  on public.community_posts for delete to authenticated
  using (author_id = auth.uid() or public.community_is_staff());

create policy community_post_likes_read
  on public.community_post_likes for select to authenticated
  using (public.community_can_access());
create policy community_post_likes_insert_self
  on public.community_post_likes for insert to authenticated
  with check (user_id = auth.uid() and public.community_can_access());
create policy community_post_likes_delete_self
  on public.community_post_likes for delete to authenticated
  using (user_id = auth.uid());

create policy community_bookmarks_read_own
  on public.community_bookmarks for select to authenticated
  using (user_id = auth.uid() and public.community_can_access());
create policy community_bookmarks_insert_own
  on public.community_bookmarks for insert to authenticated
  with check (user_id = auth.uid() and public.community_can_access());
create policy community_bookmarks_delete_own
  on public.community_bookmarks for delete to authenticated
  using (user_id = auth.uid());

comment on table public.community_posts is
  'Members-only feed. Author fields are copied from profiles at insert; clients cannot spoof them.';
