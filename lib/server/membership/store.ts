import postgres from "postgres";
import { COMPLIMENTARY_TRIAL_DAYS } from "./policy.js";

type Env = Record<string, string | undefined>;

const SCHEMA = `
create table if not exists public.membership_accounts (
  user_id uuid primary key,
  trial_started_at timestamptz,
  trial_used boolean not null default false,
  store_product_id text,
  store_status text,
  store_expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.membership_accounts enable row level security;
`;

export type MembershipRecord = {
  trialStartedAt: string | null;
  trialUsed: boolean;
  storeProductId: string | null;
  storeStatus: string | null;
  storeExpiresAt: string | null;
};

function connect(env: Env): postgres.Sql | null {
  const url = (env.SUPABASE_DB_URL || env.POSTGRES_URL || env.DATABASE_URL || "").trim();
  if (!url) return null;
  return postgres(url, { max: 1, idle_timeout: 1, connect_timeout: 8, onnotice: () => undefined });
}

async function ready(sql: postgres.Sql): Promise<void> {
  await sql.unsafe(SCHEMA);
}

function mapRow(row: Record<string, unknown> | undefined): MembershipRecord {
  return {
    trialStartedAt: row?.trial_started_at ? new Date(String(row.trial_started_at)).toISOString() : null,
    trialUsed: Boolean(row?.trial_used),
    storeProductId: row?.store_product_id ? String(row.store_product_id) : null,
    storeStatus: row?.store_status ? String(row.store_status) : null,
    storeExpiresAt: row?.store_expires_at ? new Date(String(row.store_expires_at)).toISOString() : null,
  };
}

export async function readMembershipRecord(env: Env, userId: string): Promise<MembershipRecord | null> {
  const sql = connect(env);
  if (!sql) return null;
  try {
    await ready(sql);
    const rows = await sql<Record<string, unknown>[]>`
      select trial_started_at, trial_used, store_product_id, store_status, store_expires_at
      from public.membership_accounts
      where user_id = ${userId}
      limit 1
    `;
    return mapRow(rows[0]);
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export async function startComplimentaryTrial(env: Env, userId: string, now = new Date()): Promise<"started" | "used" | "unavailable"> {
  const sql = connect(env);
  if (!sql) return "unavailable";
  try {
    await ready(sql);
    const existing = await sql<{ trial_used: boolean }[]>`
      select trial_used from public.membership_accounts where user_id = ${userId} limit 1
    `;
    if (existing[0]?.trial_used) return "used";
    const inserted = await sql<{ user_id: string }[]>`
      insert into public.membership_accounts (user_id, trial_started_at, trial_used, updated_at)
      values (${userId}, ${now.toISOString()}, true, now())
      on conflict (user_id) do update
        set trial_started_at = excluded.trial_started_at,
            trial_used = true,
            updated_at = now()
        where public.membership_accounts.trial_used = false
      returning user_id
    `;
    return inserted.length ? "started" : "used";
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export async function recordStoreEvent(
  env: Env,
  input: { userId: string; productId: string | null; status: string; expiresAt: string | null },
): Promise<boolean> {
  const sql = connect(env);
  if (!sql) return false;
  try {
    await ready(sql);
    await sql`
      insert into public.membership_accounts (user_id, store_product_id, store_status, store_expires_at, updated_at)
      values (${input.userId}, ${input.productId}, ${input.status}, ${input.expiresAt}, now())
      on conflict (user_id) do update
        set store_product_id = excluded.store_product_id,
            store_status = excluded.store_status,
            store_expires_at = excluded.store_expires_at,
            updated_at = now()
    `;
    return true;
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export function trialEndsAt(startedAt: string | null): string | null {
  if (!startedAt) return null;
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) return null;
  return new Date(start + COMPLIMENTARY_TRIAL_DAYS * 86_400_000).toISOString();
}
