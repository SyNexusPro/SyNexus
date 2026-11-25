-- Paddle customer / subscription ids on the membership ledger (service-role writes only).
alter table public.membership_accounts
  add column if not exists paddle_customer_id text;

alter table public.membership_accounts
  add column if not exists paddle_subscription_id text;

create index if not exists membership_accounts_paddle_customer_id_idx
  on public.membership_accounts (paddle_customer_id)
  where paddle_customer_id is not null;
