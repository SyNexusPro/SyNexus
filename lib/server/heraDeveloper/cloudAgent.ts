import { cloudBudget, runReserveUsd, spendAllowed } from "./policy.js";

export type CloudGate = { ok: true; reserveUsd: number } | { ok: false; reason: string };

const INVESTIGATION_PROMPT = [
  "You are preparing a SyNexus development proposal on a new branch.",
  "Do not merge, deploy, or push to main.",
  "Do not open a pull request.",
  "Do not read or print secrets, tokens, wallet keys, or environment files.",
  "Do not change payment, trading execution, wallet, authentication, or database security files.",
  "Report what you found, what you would change, and the risks. Stop after the plan.",
].join(" ");

export function cloudInvestigationGate(
  env: Record<string, string | undefined>,
  spentThisMonthUsd: number,
): CloudGate {
  const key = env.CURSOR_API_KEY?.trim() ?? "";
  if (!key) {
    return { ok: false, reason: "CURSOR_API_KEY is not set on the server." };
  }
  const reserveUsd = runReserveUsd(env);
  const allowed = spendAllowed(cloudBudget(env), spentThisMonthUsd, reserveUsd);
  if (!allowed.ok) return allowed;
  return { ok: true, reserveUsd };
}

/**
 * Asks Cursor Cloud Agents to plan on a new branch. Refuses when the key or budget is missing.
 * autoCreatePR and workOnCurrentBranch stay off, so this call cannot merge or update production.
 */
export async function requestCloudInvestigation(
  env: Record<string, string | undefined>,
  spentThisMonthUsd: number,
  note: string,
): Promise<{ ok: true; agentId: string; reserveUsd: number } | { ok: false; reason: string }> {
  const gate = cloudInvestigationGate(env, spentThisMonthUsd);
  if (!gate.ok) return gate;

  const response = await fetch("https://api.cursor.com/v1/agents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CURSOR_API_KEY!.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: { text: `${INVESTIGATION_PROMPT} Owner note: ${note.slice(0, 500)}` },
      repos: [{ url: "https://github.com/SyNexusPro/SyNexus", startingRef: "main" }],
      autoCreatePR: false,
      workOnCurrentBranch: false,
      mode: "plan",
    }),
  });

  if (!response.ok) {
    return { ok: false, reason: `Cursor Cloud Agents returned ${response.status}. No code was changed.` };
  }

  const body = (await response.json()) as { agent?: { id?: string }; id?: string };
  const agentId = body.agent?.id || body.id || "";
  if (!agentId) return { ok: false, reason: "Cursor did not return an agent id. No code was changed." };
  return { ok: true, agentId, reserveUsd: gate.reserveUsd };
}
