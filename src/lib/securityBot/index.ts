import { securityBot, guardOrThrow } from "./SecurityBot";
import type { SecurityVerdict } from "./types";
import { normalizeSynexusPlan, PLAN_STORAGE_KEY } from "../tradingFees";
import { isMalformedTokenQuery } from "./patterns";

export type { SecurityEvent, SecurityVerdict, SecurityThreatCode } from "./types";
export { securityBot, initSecurityBot, guardOrThrow } from "./SecurityBot";
export { getRecentSecurityEvents } from "./storage";

export function guardTokenScan(tokenId?: string): SecurityVerdict {
  const q = tokenId?.trim() ?? "";
  const action = securityBot.guardAction("token_scan", q.slice(0, 16));
  if (!action.allowed) return action;
  if (!q) return { allowed: true };

  if (isMalformedTokenQuery(q)) {
    return securityBot.rejectInvalidInput(
      "token_scan",
      "Invalid token query — paste a Solana mint or symbol only.",
    );
  }
  return securityBot.guardUserInput(q, { action: "token_scan" });
}

export function guardTokenReport(input: {
  reason?: string;
  details?: string;
  tokenSymbol?: string;
}): SecurityVerdict {
  const action = securityBot.guardAction("token_report");
  if (!action.allowed) return action;

  const combined = [input.reason, input.details, input.tokenSymbol].filter(Boolean).join("\n");
  return securityBot.guardUserInput(combined, { action: "token_report" });
}

export function guardBugReport(input: { subject: string; details: string; email?: string }): SecurityVerdict {
  const action = securityBot.guardAction("bug_report");
  if (!action.allowed) return action;

  const combined = [input.subject, input.details, input.email].filter(Boolean).join("\n");
  return securityBot.guardUserInput(combined, { action: "bug_report" });
}

export function guardOracleChat(text: string): SecurityVerdict {
  const action = securityBot.guardAction("oracle_chat");
  if (!action.allowed) return action;
  return securityBot.guardUserInput(text, { action: "oracle_chat" });
}

export function guardAuthAttempt(
  kind: "sign_in" | "sign_up",
  email: string,
  password = "",
): SecurityVerdict {
  if (password) {
    return securityBot.guardAuthCredentials(email, password, kind);
  }
  const action = securityBot.guardAction(kind === "sign_in" ? "auth_sign_in" : "auth_sign_up", email.toLowerCase());
  if (!action.allowed) return action;
  return securityBot.guardUserInput(email, { action: kind === "sign_in" ? "auth_sign_in" : "auth_sign_up" });
}

export function guardApiFetch(endpoint: string): SecurityVerdict {
  return securityBot.guardAction("api_fetch", endpoint.slice(0, 48));
}

export function recordTrustedPlanGrant(plan: "PRO" | "FREE", source: string) {
  securityBot.recordPlanGrant(plan, source);
}

export function verifyStoredPlan(storedPlan: string, hasPaidProfile: boolean): SecurityVerdict {
  return securityBot.verifyPlanIntegrity(storedPlan, hasPaidProfile);
}

/** Downgrade tampered Pro; sync localStorage + plan-changed event. */
export function enforceStoredPlan(storedPlan: string, hasPaidProfile: boolean) {
  const next = securityBot.enforcePlanIntegrity(storedPlan, hasPaidProfile);
  const normalized = normalizeSynexusPlan(next);
  const current = normalizeSynexusPlan(localStorage.getItem(PLAN_STORAGE_KEY));
  if (current !== normalized) {
    if (normalized === "PRO") {
      recordTrustedPlanGrant("PRO", hasPaidProfile ? "supabase_profile" : "admin");
    }
    localStorage.setItem(PLAN_STORAGE_KEY, normalized);
    window.dispatchEvent(new Event("synexus-plan-changed"));
  }
  return normalized;
}

/** Run all guards; throws on block. */
export function assertSecurity(verdict: SecurityVerdict) {
  guardOrThrow(verdict);
}
