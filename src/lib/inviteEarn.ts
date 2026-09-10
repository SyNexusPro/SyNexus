import { authHeaders } from "./authSession";
import {
  INVITE_CODE_STORAGE_KEY,
  INVITE_REWARD_UNTIL_KEY,
  buildInviteUrl,
} from "../config/inviteEarn";
import { notifySynexusPlanChanged } from "../hooks/useSynexusPlan";
import { recordTrustedPlanGrant } from "./securityBot";
import { PLAN_STORAGE_KEY } from "./tradingFees";

export type InviteStatus = {
  referralCode: string;
  inviteUrlPath: string;
  qualifiedCount: number;
  requiredCount: number;
  pendingCount: number;
  rewardClaimed: boolean;
  rewardActive: boolean;
  rewardUntil: string | null;
  identityVerified: boolean;
  cardVerified: boolean;
  referredBy: boolean;
  onboardComplete: boolean;
  error?: string;
};

export function peekInviteCode(): string {
  try {
    return (sessionStorage.getItem(INVITE_CODE_STORAGE_KEY) || localStorage.getItem(INVITE_CODE_STORAGE_KEY) || "")
      .trim()
      .toUpperCase();
  } catch {
    return "";
  }
}

export function saveInviteCode(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return;
  try {
    sessionStorage.setItem(INVITE_CODE_STORAGE_KEY, normalized);
    localStorage.setItem(INVITE_CODE_STORAGE_KEY, normalized);
  } catch {
    /* ignore */
  }
}

export function clearInviteCode() {
  try {
    sessionStorage.removeItem(INVITE_CODE_STORAGE_KEY);
    localStorage.removeItem(INVITE_CODE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function inviteShareUrl(code: string): string {
  return buildInviteUrl(code);
}

async function inviteRequest(body?: Record<string, unknown>, method: "GET" | "POST" = "POST") {
  const response = await fetch("/api/invite", {
    method,
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: method === "GET" ? undefined : JSON.stringify(body ?? { action: "status" }),
  });
  const data = (await response.json().catch(() => ({}))) as InviteStatus & {
    ok?: boolean;
    message?: string;
    url?: string;
    error?: string;
  };
  return { response, data };
}

export async function fetchInviteStatus(): Promise<InviteStatus | null> {
  try {
    const { response, data } = await inviteRequest({ action: "status" });
    if (!response.ok) return null;
    return data;
  } catch {
    return null;
  }
}

export async function attachPendingInvite(): Promise<string | null> {
  const code = peekInviteCode();
  if (!code) return null;
  try {
    const { data } = await inviteRequest({ action: "attach", code });
    if (data.ok) clearInviteCode();
    return data.message ?? null;
  } catch {
    return null;
  }
}

export async function submitInviteIdentity(input: {
  legalName: string;
  dob: string;
  country: string;
  idType: string;
  idLast4: string;
  attestation: boolean;
}): Promise<{ ok: boolean; message: string }> {
  const { data } = await inviteRequest({ action: "identity", ...input });
  return { ok: Boolean(data.ok), message: data.message || data.error || "Could not verify identity." };
}

export async function startCardVerification(): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { response, data } = await inviteRequest({ action: "card-link" });
  if (!response.ok || !data.url) {
    return { ok: false, error: data.error || "Could not open card checkout." };
  }
  return { ok: true, url: data.url };
}

export async function confirmCardVerification(): Promise<{ ok: boolean; message: string }> {
  const { data } = await inviteRequest({ action: "card-confirm" });
  return { ok: Boolean(data.ok), message: data.message || data.error || "Card not confirmed yet." };
}

export function applyInviteRewardLocally(status: InviteStatus | null) {
  if (!status?.rewardActive || !status.rewardUntil) return false;
  recordTrustedPlanGrant("PRO", "invite_30d");
  try {
    localStorage.setItem(PLAN_STORAGE_KEY, "PRO");
    localStorage.setItem(INVITE_REWARD_UNTIL_KEY, status.rewardUntil);
  } catch {
    /* ignore */
  }
  notifySynexusPlanChanged();
  return true;
}

export async function syncInviteRewardForUser(): Promise<boolean> {
  const status = await fetchInviteStatus();
  if (!status) return false;
  if (status.rewardActive) return applyInviteRewardLocally(status);

  try {
    const until = localStorage.getItem(INVITE_REWARD_UNTIL_KEY);
    const ms = until ? Date.parse(until) : NaN;
    if (Number.isFinite(ms) && ms <= Date.now()) {
      localStorage.removeItem(INVITE_REWARD_UNTIL_KEY);
    }
  } catch {
    /* ignore */
  }
  return false;
}
