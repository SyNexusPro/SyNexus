import { cloudBudget, runReserveUsd, spendAllowed } from "../heraDeveloper/policy.js";

export type OlympusGate = "none" | "deploy" | "spend" | "security" | "finance";

export type OlympusRole = {
  id: string;
  divisionId: string;
  division: string;
  role: string;
  /** Existing SyNexus agent this role uses. Null means a queued desk with no model. */
  agent: string | null;
  paid: boolean;
  gate: OlympusGate;
};

const DIVISIONS: {
  id: string;
  name: string;
  roles: { role: string; agent: string | null; paid?: boolean; gate?: OlympusGate }[];
}[] = [
  {
    id: "engineering",
    name: "Software engineering",
    roles: [
      { role: "Repository audit", agent: "Hera Developer" },
      { role: "Change proposal", agent: "Hera Developer", paid: true, gate: "deploy" },
      { role: "Test report", agent: "Hera Developer" },
      { role: "Spend check", agent: "Hera Developer", gate: "spend" },
      { role: "Approval record", agent: "Hera Developer" },
    ],
  },
  {
    id: "cyber",
    name: "Cybersecurity",
    roles: [
      { role: "Contract authority", agent: "Aegis" },
      { role: "Liquidity traps", agent: "Aegis" },
      { role: "Account hygiene", agent: "Aegis", gate: "security" },
      { role: "Wallet hygiene", agent: "Helix", gate: "security" },
      { role: "Unverified claims", agent: "Security specialist" },
    ],
  },
  {
    id: "crypto",
    name: "Cryptocurrency intelligence",
    roles: [
      { role: "Breakout checks", agent: "Pulse" },
      { role: "Whale concentration", agent: "Leviathan" },
      { role: "Live price notes", agent: "Market specialist" },
      { role: "Pattern fusion", agent: "Cipher" },
      { role: "Missing feeds", agent: "Market specialist" },
    ],
  },
  {
    id: "quality",
    name: "Quality assurance",
    roles: [
      { role: "Test review", agent: "Hera Developer" },
      { role: "Route risk", agent: "Security specialist" },
      { role: "Memory checks", agent: "History specialist" },
      { role: "Pause status", agent: "Alexus" },
      { role: "Signer warnings", agent: "Helix" },
    ],
  },
  {
    id: "evolution",
    name: "Hera evolution and intelligence",
    roles: [
      { role: "Lesson retrieval", agent: "History specialist" },
      { role: "Shared lesson review", agent: "History specialist", gate: "security" },
      { role: "Session health", agent: null },
      { role: "Memory consent audit", agent: null, gate: "security" },
      { role: "Model change review", agent: "Hera Developer", paid: true, gate: "security" },
    ],
  },
  {
    id: "growth",
    name: "Business growth and marketing",
    roles: [
      { role: "Audience notes", agent: null },
      { role: "Channel ideas", agent: null },
      { role: "Offer review", agent: null, gate: "spend" },
      { role: "Campaign queue", agent: null },
      { role: "Expansion proposal", agent: null, gate: "spend" },
    ],
  },
  {
    id: "finance",
    name: "Financial operations",
    roles: [
      { role: "Paper results", agent: "Alexus" },
      { role: "No-live-order rule", agent: "Alexus", gate: "finance" },
      { role: "Fee disclosure", agent: null },
      { role: "Expense report", agent: "Hera Developer", gate: "spend" },
      { role: "Transaction refusal", agent: "Alexus", gate: "finance" },
    ],
  },
  {
    id: "experience",
    name: "Customer experience",
    roles: [
      { role: "Feedback intake", agent: null },
      { role: "Onboarding notes", agent: null },
      { role: "Support queue", agent: null },
      { role: "Complaint patterns", agent: null },
      { role: "Retention notes", agent: null },
    ],
  },
  {
    id: "research",
    name: "Research and innovation",
    roles: [
      { role: "Stored research", agent: "History specialist" },
      { role: "Market note", agent: "Market specialist" },
      { role: "Security note", agent: "Security specialist" },
      { role: "Launch watch", agent: "Market specialist" },
      { role: "Innovation proposal", agent: "Hera Developer", paid: true, gate: "deploy" },
    ],
  },
  {
    id: "governance",
    name: "Governance and auditing",
    roles: [
      { role: "Owner gate audit", agent: null, gate: "security" },
      { role: "Protected path check", agent: "Hera Developer", gate: "security" },
      { role: "Deployment refusal", agent: "Hera Developer", gate: "deploy" },
      { role: "Privacy separation", agent: null, gate: "security" },
      { role: "Emergency shutdown", agent: null, gate: "security" },
    ],
  },
];

export function workforceRoster(): OlympusRole[] {
  const roles: OlympusRole[] = [];
  for (const division of DIVISIONS) {
    for (const role of division.roles) {
      roles.push({
        id: `${division.id}:${role.role.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        divisionId: division.id,
        division: division.name,
        role: role.role,
        agent: role.agent,
        paid: role.paid === true,
        gate: role.gate ?? "none",
      });
    }
  }
  return roles;
}

export function divisionIds(): string[] {
  return DIVISIONS.map((division) => division.id);
}

export function validateDivision(divisionId: string): { ok: boolean; reason: string } {
  const roles = workforceRoster().filter((role) => role.divisionId === divisionId);
  if (roles.length !== 5) return { ok: false, reason: "A division needs five roles before it can activate." };
  if (new Set(roles.map((role) => role.id)).size !== 5) return { ok: false, reason: "Role ids must be unique." };
  if (roles.some((role) => role.role === "Hera" || role.agent === "Hera")) {
    return { ok: false, reason: "Hera is the commander, not a division role." };
  }
  if (roles.some((role) => role.paid && role.gate === "none")) {
    return { ok: false, reason: "A paid role needs an approval gate." };
  }
  return { ok: true, reason: "Ready." };
}

export function organizationReady(): boolean {
  return divisionIds().every((id) => validateDivision(id).ok);
}

export function existingAgents(): string[] {
  return [...new Set(workforceRoster().flatMap((role) => (role.agent ? [role.agent] : [])))];
}

export type OlympusExecutor = string;

export function existingExecutors(): string[] {
  return existingAgents();
}

const TASK_TIMEOUT_MS = 15 * 60 * 1000;

export function collaboratorsFor(task: string): string[] {
  const text = task.toLowerCase();
  const roles = workforceRoster();
  const picked = new Set<string>();
  const add = (divisionId: string) => {
    const role = roles.find((item) => item.divisionId === divisionId && item.agent);
    if (role?.agent) picked.add(role.agent);
  };
  if (/code|bug|refactor|test|implement/.test(text)) add("engineering");
  if (/scam|rug|security|honeypot|privacy/.test(text)) add("cyber");
  if (/price|market|whale|mover|coin/.test(text)) add("crypto");
  if (/memory|research|learn/.test(text)) add("research");
  if (/fee|paper|revenue|expense/.test(text)) add("finance");
  if (!picked.size) add("governance");
  return [...picked].slice(0, 3);
}

export function rolesForTask(task: string): OlympusRole[] {
  const text = task.toLowerCase();
  const roles = workforceRoster();
  const division = /code|bug|refactor|implement/.test(text)
    ? "engineering"
    : /scam|rug|security|privacy/.test(text)
      ? "cyber"
      : /price|whale|market|coin/.test(text)
        ? "crypto"
        : /fee|paper|revenue|expense|transaction/.test(text)
          ? "finance"
          : /memory|research|learn/.test(text)
            ? "research"
            : /customer|support|feedback/.test(text)
              ? "experience"
              : /market campaign|growth|marketing/.test(text)
                ? "growth"
                : "governance";
  return roles.filter((role) => role.divisionId === division).slice(0, 2);
}

export function approvalRequired(role: OlympusRole): boolean {
  return role.gate !== "none";
}

export function expireStaleTasks<T extends { status: string; updatedAt: number }>(tasks: T[], now: number): T[] {
  return tasks.map((task) =>
    task.status === "running" && now - task.updatedAt > TASK_TIMEOUT_MS ? { ...task, status: "expired" } : task,
  );
}

export function dispatchWorkforce(
  task: string,
  env: Record<string, string | undefined>,
  spentUsd: number,
  halted = false,
): { ok: boolean; executors: string[]; paid: boolean; ran: false; reason: string; approval: boolean } {
  if (halted) {
    return { ok: false, executors: [], paid: false, ran: false, reason: "Olympus is shut down.", approval: false };
  }
  const roles = rolesForTask(task);
  const executors = [...new Set(roles.flatMap((role) => (role.agent ? [role.agent] : [])))];
  const paid = roles.some((role) => role.paid);
  const approval = roles.some(approvalRequired);
  if (paid) {
    const gate = spendAllowed(cloudBudget(env), spentUsd, runReserveUsd(env));
    if (!gate.ok) return { ok: false, executors, paid: true, ran: false, reason: gate.reason, approval };
  }
  if (approval) {
    return {
      ok: true,
      executors,
      paid,
      ran: false,
      approval: true,
      reason: "Hera queued this for your approval. It did not deploy, spend, or change security.",
    };
  }
  return {
    ok: true,
    executors,
    paid: false,
    ran: false,
    approval: false,
    reason: "Hera queued existing agents. No extra model was called.",
  };
}
