import postgres from "postgres";
import { evaluateDecision, noteIsUnsafe, type ProposalStatus } from "./policy.js";

const SCHEMA_SQL = `
create table if not exists public.hera_developer_proposals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  discovery text not null,
  change_summary text not null,
  why text not null,
  tests_passed text not null default '',
  tests_failed text not null default '',
  benefits text not null,
  risks text not null,
  ready boolean not null default false,
  status text not null default 'proposed' check (
    status in ('proposed', 'approved', 'rejected', 'changes_requested')
  ),
  tested_sha text not null,
  branch_name text not null default '',
  sensitive boolean not null default false,
  rollback text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.hera_developer_audit (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.hera_developer_proposals (id),
  action text not null,
  actor_user_id uuid not null,
  tested_sha text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.hera_developer_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  status text not null,
  spend_usd numeric(12, 4) not null default 0,
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists hera_developer_proposals_status_idx
  on public.hera_developer_proposals (status, created_at desc);
alter table public.hera_developer_proposals enable row level security;
alter table public.hera_developer_audit enable row level security;
alter table public.hera_developer_runs enable row level security;
`;

export type DeveloperProposal = {
  id: string;
  title: string;
  discovery: string;
  changeSummary: string;
  why: string;
  testsPassed: string;
  testsFailed: string;
  benefits: string;
  risks: string;
  ready: boolean;
  status: ProposalStatus;
  testedSha: string;
  branchName: string;
  sensitive: boolean;
  rollback: string;
  createdAt: string;
};

type Env = Record<string, string | undefined>;

function databaseUrl(env: Env): string {
  return (env.SUPABASE_DB_URL || env.POSTGRES_URL || env.DATABASE_URL || "").trim();
}

function connect(env: Env): postgres.Sql | null {
  const url = databaseUrl(env);
  if (!url) return null;
  return postgres(url, { max: 1, idle_timeout: 1, connect_timeout: 8, onnotice: () => undefined });
}

async function ensureSchema(sql: postgres.Sql): Promise<void> {
  await sql.unsafe(SCHEMA_SQL);
}

function rowToProposal(row: Record<string, unknown>): DeveloperProposal {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    discovery: String(row.discovery ?? ""),
    changeSummary: String(row.change_summary ?? ""),
    why: String(row.why ?? ""),
    testsPassed: String(row.tests_passed ?? ""),
    testsFailed: String(row.tests_failed ?? ""),
    benefits: String(row.benefits ?? ""),
    risks: String(row.risks ?? ""),
    ready: Boolean(row.ready),
    status: String(row.status ?? "proposed") as ProposalStatus,
    testedSha: String(row.tested_sha ?? ""),
    branchName: String(row.branch_name ?? ""),
    sensitive: Boolean(row.sensitive),
    rollback: String(row.rollback ?? ""),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export async function listDeveloperProposals(env: Env): Promise<DeveloperProposal[] | null> {
  const sql = connect(env);
  if (!sql) return null;
  try {
    await ensureSchema(sql);
    const rows = await sql<Record<string, unknown>[]>`
      select id, title, discovery, change_summary, why, tests_passed, tests_failed,
             benefits, risks, ready, status, tested_sha, branch_name, sensitive, rollback, created_at
      from public.hera_developer_proposals
      order by created_at desc
      limit 20
    `;
    return rows.map(rowToProposal);
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export async function monthSpendUsd(env: Env): Promise<number | null> {
  const sql = connect(env);
  if (!sql) return null;
  try {
    await ensureSchema(sql);
    const rows = await sql<{ n: number }[]>`
      select coalesce(sum(spend_usd), 0)::float as n
      from public.hera_developer_runs
      where created_at >= date_trunc('month', now())
    `;
    return Number(rows[0]?.n ?? 0);
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export async function logDeveloperRun(
  env: Env,
  input: { kind: string; status: string; spendUsd: number; detail: string },
): Promise<void> {
  const sql = connect(env);
  if (!sql) return;
  try {
    await ensureSchema(sql);
    const detail = input.detail.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]").slice(0, 500);
    await sql`
      insert into public.hera_developer_runs (kind, status, spend_usd, detail)
      values (${input.kind}, ${input.status}, ${input.spendUsd}, ${detail})
    `;
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export async function insertDeveloperProposal(
  env: Env,
  input: Omit<DeveloperProposal, "id" | "createdAt" | "status"> & { status?: ProposalStatus },
): Promise<string | null> {
  const sql = connect(env);
  if (!sql) return null;
  try {
    await ensureSchema(sql);
    const rows = await sql<{ id: string }[]>`
      insert into public.hera_developer_proposals (
        title, discovery, change_summary, why, tests_passed, tests_failed, benefits, risks,
        ready, status, tested_sha, branch_name, sensitive, rollback
      ) values (
        ${input.title}, ${input.discovery}, ${input.changeSummary}, ${input.why},
        ${input.testsPassed}, ${input.testsFailed}, ${input.benefits}, ${input.risks},
        ${input.ready}, ${input.status ?? "proposed"}, ${input.testedSha}, ${input.branchName},
        ${input.sensitive}, ${input.rollback}
      )
      returning id
    `;
    return rows[0]?.id ?? null;
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export async function applyDeveloperDecision(
  env: Env,
  input: { proposalId: string; action: string; testedSha: string; actorUserId: string; note: string },
): Promise<{ http: number; body: Record<string, unknown> }> {
  if (noteIsUnsafe(input.note)) {
    return { http: 400, body: { error: "Remove secrets from the note." } };
  }
  const sql = connect(env);
  if (!sql) return { http: 503, body: { error: "The developer log is not connected." } };
  try {
    await ensureSchema(sql);
    const found = await sql<Record<string, unknown>[]>`
      select id, status, tested_sha, sensitive
      from public.hera_developer_proposals
      where id = ${input.proposalId}
      limit 1
    `;
    const proposal = found[0];
    if (!proposal) return { http: 404, body: { error: "Proposal not found." } };

    const decision = evaluateDecision(input.action, String(proposal.tested_sha ?? ""), input.testedSha);
    if (!decision.ok) return { http: decision.http, body: { error: decision.error } };

    await sql`
      update public.hera_developer_proposals
      set status = ${decision.status}, updated_at = now()
      where id = ${input.proposalId}
        and tested_sha = ${input.testedSha}
    `;
    await sql`
      insert into public.hera_developer_audit (proposal_id, action, actor_user_id, tested_sha, note)
      values (
        ${input.proposalId},
        ${decision.status},
        ${input.actorUserId},
        ${input.testedSha},
        ${input.note.slice(0, 500)}
      )
    `;
    return {
      http: 200,
      body: {
        ok: true,
        status: decision.status,
        deploy: false,
        sensitive: Boolean(proposal.sensitive),
        message: "Decision recorded. Nothing was merged or deployed.",
      },
    };
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export function spokenDeveloperReport(proposals: DeveloperProposal[]): string {
  if (!proposals.length) {
    return "Hera Developer has no proposals waiting. Nothing has been deployed.";
  }
  const open = proposals.filter((item) => item.status === "proposed");
  const lead = open[0] ?? proposals[0];
  return [
    `Hera Developer has ${open.length} proposal${open.length === 1 ? "" : "s"} waiting.`,
    `${lead.title}.`,
    lead.discovery,
    lead.changeSummary,
    lead.testsFailed.trim() ? `Tests failed: ${lead.testsFailed}` : `Tests: ${lead.testsPassed}`,
    `Ready for deployment: ${lead.ready ? "yes, after your approval" : "no"}.`,
    "Nothing has been merged or deployed.",
  ].join(" ");
}
