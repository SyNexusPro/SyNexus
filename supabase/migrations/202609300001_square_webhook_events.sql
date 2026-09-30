-- Square webhook idempotency. Duplicate event_id values must not apply a payment twice.
-- Service role inserts; no anon or authenticated policies.

create table if not exists public.square_webhook_events (
  event_id text primary key,
  event_type text not null default '',
  created_at timestamptz not null default now()
);

alter table public.square_webhook_events enable row level security;

comment on table public.square_webhook_events is 'Square webhook event_id ledger. Duplicate notifications are ignored. Service role only.';
