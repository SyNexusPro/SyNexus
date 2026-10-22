-- Alexus -> Hera learning reports (written only by POST /api/hera/ingest with the service role).
-- Run in Supabase SQL Editor (safe to re-run). Not applied automatically.

create table if not exists public.alexus_reports (
  id uuid primary key default gen_random_uuid(),
  bot text not null,
  seq bigint not null,
  report_at timestamptz not null,
  received_at timestamptz not null default now(),
  scrubbed_values integer not null default 0,
  events_count integer not null default 0,
  snapshot jsonb not null default '{}'::jsonb,
  events jsonb not null default '{}'::jsonb,
  note text not null default ''
);

-- A resent report is a no-op; a restarted counter on the bot (same seq, new time) is stored.
create unique index if not exists alexus_reports_bot_seq_at_uidx
  on public.alexus_reports (bot, seq, report_at);

create index if not exists alexus_reports_received_idx
  on public.alexus_reports (received_at desc);

-- No policies on purpose: only the server-side service role reads or writes this table.
alter table public.alexus_reports enable row level security;

comment on table public.alexus_reports is 'Redacted one-way learning reports from the Alexus trading bot. Advisory data for Hera; never read by clients.';
