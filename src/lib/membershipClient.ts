import { authHeaders } from "./authSession";
import { mirrorComplimentaryNextLevelGrant, syncProTrialForUser } from "./proDemo";

export type MembershipSnapshot = {
  authenticated: boolean;
  owner: boolean;
  developer: boolean;
  tier: "free" | "next_level" | "pantheon";
  source: "owner" | "paddle" | "revenuecat" | "complimentary_trial" | "none";
  social: boolean;
  feeBps: number;
  feeDisclosure: string;
  trialEndsAt: string | null;
  trialEligible?: boolean;
  paddleCustomerId?: string | null;
  webCheckout: "paddle" | "disabled";
  manageSubscription?: boolean;
  verification: "live" | "unavailable";
};

/** Restore a local mirror, or request the one-shot server complimentary Next Level grant. */
export async function ensureComplimentaryNextLevel(userId: string): Promise<"restored" | "started" | "skipped"> {
  if (!userId || userId.startsWith("demo-")) return "skipped";
  if (syncProTrialForUser(userId)) return "restored";
  try {
    const snap = await startComplimentaryTrial();
    if (snap.tier === "next_level" || snap.source === "complimentary_trial") {
      mirrorComplimentaryNextLevelGrant(userId, snap.trialEndsAt);
      return "started";
    }
  } catch {
    /* 409 already used / 503 ledger unavailable — stay free */
  }
  return "skipped";
}

export async function fetchMembership(): Promise<MembershipSnapshot> {
  const response = await fetch("/api/membership", { headers: await authHeaders(), cache: "no-store" });
  const body = (await response.json().catch(() => null)) as MembershipSnapshot & { error?: string };
  if (!response.ok) throw new Error(body?.error || "Membership could not be verified.");
  return body;
}

export async function startComplimentaryTrial(): Promise<MembershipSnapshot> {
  const response = await fetch("/api/membership/trial", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: "{}",
  });
  const body = (await response.json().catch(() => null)) as MembershipSnapshot & { error?: string };
  if (!response.ok) throw new Error(body?.error || "The trial could not be started.");
  return body;
}

export async function refreshMembershipAfterRestore(): Promise<MembershipSnapshot> {
  const response = await fetch("/api/membership/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: "{}",
  });
  const body = (await response.json().catch(() => null)) as MembershipSnapshot & { error?: string };
  if (!response.ok) throw new Error(body?.error || "Purchases could not be restored.");
  return body;
}
