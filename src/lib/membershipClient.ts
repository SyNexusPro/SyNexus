import { authHeaders } from "./authSession";

export type MembershipSnapshot = {
  authenticated: boolean;
  owner: boolean;
  developer: boolean;
  tier: "free" | "next_level" | "pantheon";
  source: "owner" | "revenuecat" | "complimentary_trial" | "none";
  social: boolean;
  feeBps: number;
  feeDisclosure: string;
  trialEndsAt: string | null;
  webCheckout: "disabled";
  verification: "live" | "unavailable";
};

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
