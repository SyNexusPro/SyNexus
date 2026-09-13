-- SyNexus MFA / AAL2 hardening. Safe to re-run.
-- Does not disable RLS. Does not store secrets.

alter table public.security_events
  add column if not exists success boolean;
alter table public.security_events
  add column if not exists device_description text;

comment on column public.security_events.success is 'Outcome only — never store codes, tokens, or biometrics';
comment on column public.security_events.device_description is 'Coarse device label (Android/Web). No fingerprint data.';

create or replace function public.jwt_aal()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1');
$$;

-- Sensitive mutations require AAL2. Reads and first-time profile insert stay at AAL1
-- so MFA enrollment can finish.

drop policy if exists "watchlists_all_own" on public.watchlists;
drop policy if exists "watchlists_select_own" on public.watchlists;
drop policy if exists "watchlists_write_own_aal2" on public.watchlists;
create policy "watchlists_select_own"
  on public.watchlists for select
  using (auth.uid() = user_id);
create policy "watchlists_write_own_aal2"
  on public.watchlists for all
  using (auth.uid() = user_id and public.jwt_aal() = 'aal2')
  with check (auth.uid() = user_id and public.jwt_aal() = 'aal2');

drop policy if exists "watchlist_tokens_insert_own" on public.watchlist_tokens;
create policy "watchlist_tokens_insert_own"
  on public.watchlist_tokens for insert
  with check (
    public.jwt_aal() = 'aal2'
    and exists (
      select 1
      from public.watchlists w
      where w.id = watchlist_id
        and w.user_id = auth.uid()
    )
  );

drop policy if exists "watchlist_tokens_delete_own" on public.watchlist_tokens;
create policy "watchlist_tokens_delete_own"
  on public.watchlist_tokens for delete
  using (
    public.jwt_aal() = 'aal2'
    and exists (
      select 1
      from public.watchlists w
      where w.id = watchlist_id
        and w.user_id = auth.uid()
    )
  );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id and public.jwt_aal() = 'aal2')
  with check (auth.uid() = id and public.jwt_aal() = 'aal2');
