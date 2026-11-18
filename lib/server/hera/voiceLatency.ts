import postgres from "postgres";
import { summarizeLatency } from "../../../src/lib/hera/latencyStats.js";

type Env = Record<string, string | undefined>;

const SCHEMA = `
create table if not exists public.hera_voice_latency (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  ms integer not null,
  created_at timestamptz not null default now()
);
alter table public.hera_voice_latency enable row level security;
`;

function connect(env: Env): postgres.Sql | null {
  const url = (env.SUPABASE_DB_URL || env.POSTGRES_URL || env.DATABASE_URL || "").trim();
  if (!url) return null;
  return postgres(url, { max: 1, idle_timeout: 1, connect_timeout: 8, onnotice: () => undefined });
}

export async function recordVoiceLatency(env: Env, userId: string, ms: number): Promise<boolean> {
  if (!Number.isFinite(ms) || ms < 0 || ms > 60_000) return false;
  const sql = connect(env);
  if (!sql) return false;
  try {
    await sql.unsafe(SCHEMA);
    await sql`
      insert into public.hera_voice_latency (user_id, ms)
      values (${userId}, ${Math.round(ms)})
    `;
    await sql`
      delete from public.hera_voice_latency
      where user_id = ${userId}
        and id not in (
          select id from public.hera_voice_latency
          where user_id = ${userId}
          order by created_at desc
          limit 400
        )
    `;
    return true;
  } catch {
    return false;
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export async function readVoiceLatency(env: Env, userId: string): Promise<{ count: number; p50: number | null; p95: number | null }> {
  const empty = { count: 0, p50: null, p95: null };
  const sql = connect(env);
  if (!sql) return empty;
  try {
    await sql.unsafe(SCHEMA);
    const rows = await sql<{ ms: number }[]>`
      select ms from public.hera_voice_latency
      where user_id = ${userId}
        and created_at > now() - interval '14 days'
      order by ms asc
      limit 400
    `;
    return summarizeLatency(rows.map((row) => row.ms));
  } catch {
    return empty;
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}
