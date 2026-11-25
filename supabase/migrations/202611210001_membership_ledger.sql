-- Membership ledger for complimentary grants and RevenueCat webhook idempotency.

create table if not exists public.membership_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  trial_started_at timestamptz,
  trial_used boolean not null default false,
  store_product_id text,
  store_status text,
  store_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.membership_webhook_events (
  event_id text primary key,
  user_id uuid references auth.users (id) on delete set null,
  event_type text,
  received_at timestamptz not null default now()
);

create index if not exists membership_accounts_store_status_idx
  on public.membership_accounts (store_status);

create index if not exists membership_webhook_events_user_id_idx
  on public.membership_webhook_events (user_id);

alter table public.membership_accounts enable row level security;
alter table public.membership_webhook_events enable row level security;

-- No client policies: only the service/database URL used by the API may write these tables.
