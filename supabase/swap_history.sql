-- SyNexus in-app swap history (public on-chain facts only)
-- NEVER store private keys, seed phrases, or wallet secrets.
-- Run in Supabase SQL Editor (safe to re-run).

create table if not exists public.swap_history (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  tx_signature text,
  input_mint text not null,
  output_mint text not null,
  input_symbol text,
  output_symbol text,
  input_amount text,
  output_amount_est text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed')),
  price_impact_pct double precision,
  created_at timestamptz not null default now()
);

create unique index if not exists swap_history_sig_uidx
  on public.swap_history (tx_signature)
  where tx_signature is not null;

create index if not exists swap_history_wallet_idx
  on public.swap_history (wallet_address, created_at desc);

alter table public.swap_history enable row level security;

drop policy if exists swap_history_insert on public.swap_history;
create policy swap_history_insert on public.swap_history
  for insert to anon, authenticated
  with check (
    char_length(wallet_address) between 32 and 64
    and (tx_signature is null or char_length(tx_signature) between 64 and 128)
  );

drop policy if exists swap_history_select on public.swap_history;
create policy swap_history_select on public.swap_history
  for select to anon, authenticated
  using (true);

comment on table public.swap_history is
  'Public Jupiter swap records only — wallet, signature, pair, amount, time, status. No keys.';
