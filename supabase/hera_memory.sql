-- Hera research and Alexus trade-pattern memory.
-- Run in the Supabase SQL editor (safe to re-run). Not applied automatically.
-- Service role only. The browser cannot read or write these rows.

create extension if not exists vector;

create table if not exists public.hera_memory (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('research', 'trade_pattern', 'lesson')),
  source text not null,
  content text not null,
  content_hash text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create unique index if not exists hera_memory_kind_hash_uidx
  on public.hera_memory (kind, content_hash);

create index if not exists hera_memory_embedding_idx
  on public.hera_memory using hnsw (embedding vector_cosine_ops);

alter table public.hera_memory enable row level security;

revoke all on table public.hera_memory from anon, authenticated;

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
as $$
  select
    m.id,
    m.kind,
    m.source,
    m.content,
    1 - (m.embedding <=> query_embedding) as similarity
  from public.hera_memory m
  where m.embedding is not null
    and (filter_kind is null or m.kind = filter_kind)
  order by m.embedding <=> query_embedding
  limit greatest(1, least(match_count, 8));
$$;

revoke all on function public.match_hera_memory(vector, integer, text) from public, anon, authenticated;

comment on table public.hera_memory is 'Retrieved research and paper trade patterns for Hera. Advisory only; never a trade instruction.';
