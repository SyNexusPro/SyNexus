import postgres from "postgres";
import { sanitizeOwnerHeraTurns, type OwnerHeraTurn } from "../../ownerHeraThread.js";

type Env = Record<string, string | undefined>;

const SCHEMA = `
create table if not exists public.owner_hera_direct (
  user_id uuid primary key,
  turns jsonb not null default '[]'::jsonb,
  push_endpoint text,
  push_p256dh text,
  push_auth text,
  updated_at timestamptz not null default now()
);
create table if not exists public.owner_hera_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  action text not null,
  created_at timestamptz not null default now()
);
alter table public.owner_hera_direct enable row level security;
alter table public.owner_hera_audit enable row level security;
`;

function connect(env: Env): postgres.Sql | null {
  const url = (env.SUPABASE_DB_URL || env.POSTGRES_URL || env.DATABASE_URL || "").trim();
  if (!url) return null;
  return postgres(url, { max: 1, idle_timeout: 1, connect_timeout: 8, onnotice: () => undefined });
}

async function ready(sql: postgres.Sql): Promise<void> {
  await sql.unsafe(SCHEMA);
}

export async function recordOwnerHeraAccess(env: Env, userId: string, action: string): Promise<void> {
  const sql = connect(env);
  if (!sql) return;
  try {
    await ready(sql);
    await sql`
      insert into public.owner_hera_audit (user_id, action)
      values (${userId}, ${action.slice(0, 40)})
    `;
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export async function readOwnerHeraThread(env: Env, userId: string): Promise<OwnerHeraTurn[]> {
  const sql = connect(env);
  if (!sql) return [];
  try {
    await ready(sql);
    const rows = await sql<{ turns: unknown }[]>`
      select turns from public.owner_hera_direct where user_id = ${userId} limit 1
    `;
    return sanitizeOwnerHeraTurns(rows[0]?.turns);
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export async function writeOwnerHeraThread(env: Env, userId: string, turns: OwnerHeraTurn[]): Promise<boolean> {
  const sql = connect(env);
  if (!sql) return false;
  const clean = sanitizeOwnerHeraTurns(turns);
  try {
    await ready(sql);
    await sql`
      insert into public.owner_hera_direct (user_id, turns, updated_at)
      values (${userId}, ${sql.json(clean)}, now())
      on conflict (user_id) do update
        set turns = excluded.turns,
            updated_at = now()
    `;
    return true;
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export async function saveOwnerHeraPush(
  env: Env,
  userId: string,
  subscription: { endpoint: string; p256dh: string; auth: string },
): Promise<boolean> {
  const sql = connect(env);
  if (!sql) return false;
  try {
    await ready(sql);
    await sql`
      insert into public.owner_hera_direct (user_id, push_endpoint, push_p256dh, push_auth, updated_at)
      values (${userId}, ${subscription.endpoint}, ${subscription.p256dh}, ${subscription.auth}, now())
      on conflict (user_id) do update
        set push_endpoint = excluded.push_endpoint,
            push_p256dh = excluded.push_p256dh,
            push_auth = excluded.push_auth,
            updated_at = now()
    `;
    await sql`
      insert into public.owner_hera_audit (user_id, action)
      values (${userId}, ${"push_registered"})
    `;
    return true;
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export function buildOwnerPushPayload(title: string, body: string): string {
  return JSON.stringify({
    title: title.slice(0, 80),
    body: body.slice(0, 180),
    url: "/owner/hera",
    tag: "synexus-hera",
    icon: "/hera/hera-face.png",
  });
}

export async function notifyOwnerHera(env: Env, title: string, body: string): Promise<boolean> {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return false;
  const sql = connect(env);
  if (!sql) return false;
  try {
    await ready(sql);
    const rows = await sql<{ push_endpoint: string; push_p256dh: string; push_auth: string }[]>`
      select push_endpoint, push_p256dh, push_auth
      from public.owner_hera_direct
      where push_endpoint is not null
        and push_p256dh is not null
        and push_auth is not null
    `;
    if (!rows.length) return false;
    const webpush = await import("web-push");
    webpush.setVapidDetails(env.VAPID_SUBJECT?.trim() || "mailto:thesynexus@synexus.pro", publicKey, privateKey);
    const payload = buildOwnerPushPayload(title, body);
    await Promise.all(
      rows.map((row) =>
        webpush
          .sendNotification(
            { endpoint: row.push_endpoint, keys: { p256dh: row.push_p256dh, auth: row.push_auth } },
            payload,
          )
          .catch(() => undefined),
      ),
    );
    return true;
  } catch {
    return false;
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}
