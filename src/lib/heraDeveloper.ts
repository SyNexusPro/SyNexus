import { getAccessToken } from "./authSession";

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
  status: "proposed" | "approved" | "rejected" | "changes_requested";
  testedSha: string;
  branchName: string;
  sensitive: boolean;
  rollback: string;
  createdAt: string;
};

async function ownerFetch(path: string, init?: RequestInit): Promise<Response | null> {
  const token = await getAccessToken();
  if (!token) return null;
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function fetchDeveloperProposals(): Promise<DeveloperProposal[] | null> {
  const response = await ownerFetch("/api/owner/developer/proposals");
  if (!response?.ok) return null;
  const data = (await response.json()) as { proposals?: DeveloperProposal[] };
  return Array.isArray(data.proposals) ? data.proposals : null;
}

export async function decideDeveloperProposal(
  proposal: DeveloperProposal,
  action: "approve" | "reject" | "request_changes",
  note: string,
): Promise<{ ok: boolean; message: string }> {
  const response = await ownerFetch("/api/owner/developer/decision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      proposalId: proposal.id,
      action,
      testedSha: proposal.testedSha,
      note,
    }),
  });
  if (!response) return { ok: false, message: "Sign in with the owner account." };
  const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
  if (!response.ok) return { ok: false, message: data.error ?? "The decision was not recorded." };
  return { ok: true, message: data.message ?? "Decision recorded. Nothing was deployed." };
}

export function isDeveloperReportRequest(text: string): boolean {
  return /\b(developer report|hera developer|development review|what did you (?:change|propose)|pending proposal)\b/i.test(text);
}

export async function fetchDeveloperReport(): Promise<{ spoken: string; detail: string } | null> {
  const response = await ownerFetch("/api/owner/developer/report");
  if (!response?.ok) return null;
  const data = (await response.json()) as { spoken?: unknown; detail?: unknown };
  if (typeof data.spoken !== "string" || typeof data.detail !== "string") return null;
  return { spoken: data.spoken, detail: data.detail };
}
