import crypto from "node:crypto";
import postgres from "postgres";
import { formatHeraMind, proposeSharedLesson } from "./unifiedMind.js";

type Env = Record<string, string | undefined>;

const SCHEMA = `
create table if not exists public.hera_mind_consent (
  user_id uuid primary key,
  personal_memory boolean not null default false,
  shared_learning boolean not null default false,
  updated_at timestamptz not null default now()
);
create table if not exists public.hera_personal_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  note text not null,
  note_hash text not null,
  created_at timestamptz not null default now(),
  unique (user_id, note_hash)
);
create table if not exists public.hera_shared_lessons (
  id uuid primary key default gen_random_uuid(),
  lesson text not null,
  lesson_hash text not null unique,
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
create table if not exists public.hera_mind_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  action text not null,
  created_at timestamptz not null default now()
);
alter table public.hera_mind_consent enable row level security;
alter table public.hera_personal_memory enable row level security;
alter table public.hera_shared_lessons enable row level security;
alter table public.hera_mind_audit enable row level security;
`;

function connect(env: Env): postgres.Sql | null {
  const url = (env.SUPABASE_DB_URL || env.POSTGRES_URL || env.DATABASE_URL || "").trim();
  if (!url) return null;
  return postgres(url, { max: 1, idle_timeout: 1, connect_timeout: 8, onnotice: () => undefined });
}

async function ready(sql: postgres.Sql): Promise<void> {
  await sql.unsafe(SCHEMA);
}

function hash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function readHeraMind(env: Env, userId: string, owner: boolean): Promise<{
  available: boolean;
  personalMemory: boolean;
  sharedLearning: boolean;
  personalNotes: string[];
  sharedLessons: string[];
  proposals: { id: string; lesson: string }[];
  context: string;
}> {
  const empty = {
    available: false,
    personalMemory: false,
    sharedLearning: false,
    personalNotes: [] as string[],
    sharedLessons: [] as string[],
    proposals: [] as { id: string; lesson: string }[],
    context: formatHeraMind({ personalConsent: false, personalNotes: [], sharedLessons: [], memoryAvailable: false }),
  };
  const sql = connect(env);
  if (!sql) return empty;
  try {
    await ready(sql);
    const consent = await sql<{ personal_memory: boolean; shared_learning: boolean }[]>`
      select personal_memory, shared_learning from public.hera_mind_consent where user_id = ${userId} limit 1
    `;
    const personalMemory = Boolean(consent[0]?.personal_memory);
    const sharedLearning = Boolean(consent[0]?.shared_learning);
    const notes = personalMemory
      ? await sql<{ note: string }[]>`
          select note from public.hera_personal_memory
          where user_id = ${userId}
          order by created_at desc
          limit 8
        `
      : [];
    const shared = await sql<{ lesson: string }[]>`
      select lesson from public.hera_shared_lessons
      where status = 'approved'
      order by created_at desc
      limit 8
    `;
    const proposals = owner
      ? await sql<{ id: string; lesson: string }[]>`
          select id, lesson from public.hera_shared_lessons
          where status = 'proposed'
          order by created_at desc
          limit 12
        `
      : [];
    const personalNotes = notes.map((row) => row.note);
    const sharedLessons = shared.map((row) => row.lesson);
    return {
      available: true,
      personalMemory,
      sharedLearning,
      personalNotes,
      sharedLessons,
      proposals,
      context: formatHeraMind({ personalConsent: personalMemory, personalNotes, sharedLessons, memoryAvailable: true }),
    };
  } catch {
    return empty;
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export async function setHeraMindConsent(
  env: Env,
  userId: string,
  consent: { personalMemory: boolean; sharedLearning: boolean },
): Promise<boolean> {
  const sql = connect(env);
  if (!sql) return false;
  try {
    await ready(sql);
    await sql`
      insert into public.hera_mind_consent (user_id, personal_memory, shared_learning, updated_at)
      values (${userId}, ${consent.personalMemory}, ${consent.sharedLearning}, now())
      on conflict (user_id) do update
        set personal_memory = excluded.personal_memory,
            shared_learning = excluded.shared_learning,
            updated_at = now()
    `;
    if (!consent.personalMemory) {
      await sql`delete from public.hera_personal_memory where user_id = ${userId}`;
    }
    await sql`insert into public.hera_mind_audit (user_id, action) values (${userId}, ${"consent"})`;
    return true;
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export async function savePersonalNote(env: Env, userId: string, note: string): Promise<boolean> {
  const sql = connect(env);
  if (!sql) return false;
  try {
    await ready(sql);
    const consent = await sql<{ personal_memory: boolean }[]>`
      select personal_memory from public.hera_mind_consent where user_id = ${userId} limit 1
    `;
    if (!consent[0]?.personal_memory) return false;
    await sql`
      insert into public.hera_personal_memory (user_id, note, note_hash)
      values (${userId}, ${note}, ${hash(`${userId}:${note}`)})
      on conflict (user_id, note_hash) do nothing
    `;
    return true;
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export async function forgetPersonalMemory(env: Env, userId: string): Promise<boolean> {
  const sql = connect(env);
  if (!sql) return false;
  try {
    await ready(sql);
    await sql`delete from public.hera_personal_memory where user_id = ${userId}`;
    await sql`
      insert into public.hera_mind_consent (user_id, personal_memory, shared_learning, updated_at)
      values (${userId}, false, coalesce((select shared_learning from public.hera_mind_consent where user_id = ${userId}), false), now())
      on conflict (user_id) do update set personal_memory = false, updated_at = now()
    `;
    await sql`insert into public.hera_mind_audit (user_id, action) values (${userId}, ${"forget"})`;
    return true;
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export async function proposeLesson(env: Env, userId: string, lesson: string): Promise<"proposed" | "rejected" | "unavailable"> {
  const decision = proposeSharedLesson(lesson);
  if (!decision.ok) return "rejected";
  const sql = connect(env);
  if (!sql) return "unavailable";
  try {
    await ready(sql);
    const consent = await sql<{ shared_learning: boolean }[]>`
      select shared_learning from public.hera_mind_consent where user_id = ${userId} limit 1
    `;
    if (!consent[0]?.shared_learning) return "rejected";
    await sql`
      insert into public.hera_shared_lessons (lesson, lesson_hash, status)
      values (${decision.lesson}, ${hash(decision.lesson)}, 'proposed')
      on conflict (lesson_hash) do nothing
    `;
    await sql`insert into public.hera_mind_audit (user_id, action) values (${userId}, ${"propose"})`;
    return "proposed";
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export async function decideSharedLesson(
  env: Env,
  lessonId: string,
  approve: boolean,
): Promise<boolean> {
  const sql = connect(env);
  if (!sql) return false;
  try {
    await ready(sql);
    if (approve) {
      const rows = await sql<{ lesson: string }[]>`
        select lesson from public.hera_shared_lessons where id = ${lessonId} and status = 'proposed' limit 1
      `;
      const decision = rows[0] ? proposeSharedLesson(rows[0].lesson) : { ok: false as const, reason: "missing" };
      if (!decision.ok) {
        await sql`update public.hera_shared_lessons set status = 'rejected' where id = ${lessonId}`;
        return false;
      }
    }
    await sql`
      update public.hera_shared_lessons
      set status = ${approve ? "approved" : "rejected"}
      where id = ${lessonId} and status = 'proposed'
    `;
    return true;
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}
