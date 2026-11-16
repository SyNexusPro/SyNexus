export const PROTECTED_PATHS = [
  ".env",
  "api/_routes/checkout.ts",
  "api/_routes/ownerUnlock.ts",
  "lib/server/ownerSession.ts",
  "src/lib/ownerAccess.ts",
  "src/config/tradingFees.ts",
  "src/lib/synWallet/",
  "src/context/SynWalletContext.tsx",
  "src/pages/SynWallet.tsx",
  "supabase/",
] as const;

const DEPLOY_ACTIONS = new Set(["deploy", "merge", "ship", "release", "push"]);

export type ProposalStatus = "proposed" | "approved" | "rejected" | "changes_requested";

export type DecisionResult =
  | { ok: true; status: ProposalStatus; deploy: false }
  | { ok: false; http: number; error: string };

export function pathIsProtected(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/").replace(/^\.\//, "");
  return PROTECTED_PATHS.some((guard) => {
    if (guard.endsWith("/")) return normalized.includes(guard) || normalized.startsWith(guard);
    return normalized === guard || normalized.endsWith(`/${guard}`) || normalized.includes(guard);
  });
}

export function diffIsSensitive(files: string[]): boolean {
  return files.some((file) => pathIsProtected(file));
}

export function noteIsUnsafe(note: string): boolean {
  return /postgres(?:ql)?:\/\//i.test(note) || /\beyJ[A-Za-z0-9_-]{8,}/.test(note) || /\bsk-[A-Za-z0-9]{8,}/.test(note);
}

/** Approval never deploys. A changed revision cannot reuse an older approval. */
export function evaluateDecision(action: string, proposalSha: string, submittedSha: string): DecisionResult {
  const normalized = action.trim().toLowerCase();
  if (DEPLOY_ACTIONS.has(normalized)) {
    return { ok: false, http: 403, error: "Hera Developer cannot merge or deploy. Approval only records your decision." };
  }
  if (normalized !== "approve" && normalized !== "reject" && normalized !== "request_changes") {
    return { ok: false, http: 400, error: "Choose approve, reject, or request changes." };
  }
  if (!proposalSha.trim() || !submittedSha.trim()) {
    return { ok: false, http: 400, error: "The tested revision is missing." };
  }
  if (proposalSha.trim() !== submittedSha.trim()) {
    return {
      ok: false,
      http: 409,
      error: "The code changed after this proposal was tested. A new approval is required.",
    };
  }
  const status: ProposalStatus =
    normalized === "approve" ? "approved" : normalized === "reject" ? "rejected" : "changes_requested";
  return { ok: true, status, deploy: false };
}

export function spendAllowed(limitUsd: number, spentUsd: number, reserveUsd: number): { ok: true } | { ok: false; reason: string } {
  if (!Number.isFinite(limitUsd) || limitUsd <= 0) {
    return { ok: false, reason: "Cloud development is off until HERA_DEVELOPER_MONTHLY_USD is set above 0 on the server." };
  }
  if (!Number.isFinite(reserveUsd) || reserveUsd <= 0) {
    return { ok: false, reason: "A cloud run needs a positive spend reserve." };
  }
  if (spentUsd + reserveUsd > limitUsd) {
    return { ok: false, reason: "This run would pass the monthly Hera Developer spending limit." };
  }
  return { ok: true };
}

export function cloudBudget(env: Record<string, string | undefined>): number {
  const parsed = Number(env.HERA_DEVELOPER_MONTHLY_USD ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function runReserveUsd(env: Record<string, string | undefined>): number {
  const parsed = Number(env.HERA_DEVELOPER_RUN_RESERVE_USD ?? "1");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
