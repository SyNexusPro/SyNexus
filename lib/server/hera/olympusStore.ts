import postgres from "postgres";
import { rolesForTask, type OlympusRole } from "./olympus.js";

type Env = Record<string, string | undefined>;

const SCHEMA = `
create table if not exists public.olympus_control (
  id boolean primary key default true,
  halted boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint olympus_control_one check (id)
);
create table if not exists public.olympus_tasks (
  id uuid primary key default gen_random_uuid(),
  role_id text not null,
  division text not null,
  title text not null,
  status text not null default 'queued',
  note text not null default '',
  requires_approval boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.olympus_control enable row level security;
alter table public.olympus_tasks enable row level security;
`;

export type OlympusTask = {
  id: string;
  roleId: string;
  division: string;
  title: string;
  status: string;
  note: string;
  requiresApproval: boolean;
  createdAt: string;
};

function connect(env: Env): postgres.Sql | null {
  const url = (env.SUPABASE_DB_URL || env.POSTGRES_URL || env.DATABASE_URL || "").trim();
  if (!url) return null;
  return postgres(url, { max: 1, idle_timeout: 1, connect_timeout: 8, onnotice: () => undefined });
}

async function ready(sql: postgres.Sql): Promise<void> {
  await sql.unsafe(SCHEMA);
}

export async function readOlympusState(env: Env): Promise<{ halted: boolean; tasks: OlympusTask[]; available: boolean }> {
  const sql = connect(env);
  if (!sql) return { halted: false, tasks: [], available: false };
  try {
    await ready(sql);
    const control = await sql<{ halted: boolean }[]>`select halted from public.olympus_control where id = true limit 1`;
    await sql`
      update public.olympus_tasks
      set status = 'expired', updated_at = now()
      where status = 'running' and updated_at < now() - interval '15 minutes'
    `;
    const rows = await sql<{
      id: string;
      role_id: string;
      division: string;
      title: string;
      status: string;
      note: string;
      requires_approval: boolean;
      created_at: Date;
    }[]>`
      select id, role_id, division, title, status, note, requires_approval, created_at
      from public.olympus_tasks
      order by created_at desc
      limit 40
    `;
    return {
      halted: Boolean(control[0]?.halted),
      available: true,
      tasks: rows.map((row) => ({
        id: row.id,
        roleId: row.role_id,
        division: row.division,
        title: row.title,
        status: row.status,
        note: row.note,
        requiresApproval: row.requires_approval,
        createdAt: new Date(row.created_at).toISOString(),
      })),
    };
  } catch {
    return { halted: false, tasks: [], available: false };
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export async function setOlympusHalted(env: Env, halted: boolean): Promise<boolean> {
  const sql = connect(env);
  if (!sql) return false;
  try {
    await ready(sql);
    await sql`
      insert into public.olympus_control (id, halted, updated_at)
      values (true, ${halted}, now())
      on conflict (id) do update set halted = excluded.halted, updated_at = now()
    `;
    return true;
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export async function enqueueOlympusTask(env: Env, title: string, halted: boolean): Promise<"queued" | "halted" | "unavailable"> {
  if (halted) return "halted";
  const roles = rolesForTask(title);
  const role = roles[0];
  if (!role) return "unavailable";
  const sql = connect(env);
  if (!sql) return "unavailable";
  try {
    await ready(sql);
    const existing = await sql<{ id: string }[]>`
      select id from public.olympus_tasks
      where title = ${title.slice(0, 180)} and status in ('queued', 'running', 'proposed')
      limit 1
    `;
    if (existing.length) return "queued";
    await sql`
      insert into public.olympus_tasks (role_id, division, title, status, requires_approval)
      values (${role.id}, ${role.division}, ${title.slice(0, 180)}, 'queued', ${role.gate !== "none"})
    `;
    return "queued";
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export async function decideOlympusTask(env: Env, id: string, approve: boolean): Promise<boolean> {
  const sql = connect(env);
  if (!sql) return false;
  try {
    await ready(sql);
    await sql`
      update public.olympus_tasks
      set status = ${approve ? "approved" : "rejected"}, updated_at = now(), note = 'Owner decision. Not deployed.'
      where id = ${id} and status in ('queued', 'proposed')
    `;
    return true;
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export function roleStatus(role: OlympusRole, tasks: OlympusTask[], halted: boolean): "offline" | "idle" | "assigned" {
  if (halted) return "offline";
  return tasks.some((task) => task.roleId === role.id && (task.status === "queued" || task.status === "running" || task.status === "proposed"))
    ? "assigned"
    : "idle";
}
