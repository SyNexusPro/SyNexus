/** Documented ecosystem parameters (UI + future program design). Adjust before mainnet. */

import { PUBLIC_SITE_URL } from "./site";

export const SYNEXUS_SITE_URL = PUBLIC_SITE_URL;

export const STAKING_STATUS: "planned" | "live" = "planned";

/** Basis points for future on-chain staking (100 bps = 1%). */
export const STAKING_FEE_BPS = {
  deposit: 50,
  withdrawal: 30,
  /** Share of accrued rewards routed to treasury / protocol. */
  rewardsProtocol: 1000,
} as const;

export function bpsToLabel(bps: number): string {
  const pct = bps / 100;
  if (Number.isInteger(pct)) return `${pct}%`;
  const rounded = Math.round(pct * 100) / 100;
  return `${rounded}%`;
}

export const AFFILIATE_TIERS = [
  {
    tier: "Scout",
    qualifiedVolumeUsd: "$0 – $499",
    exampleRevSharePct: "10%",
  },
  {
    tier: "Ranger",
    qualifiedVolumeUsd: "$500 – $4,999",
    exampleRevSharePct: "15%",
  },
  {
    tier: "Swarm",
    qualifiedVolumeUsd: "$5,000+",
    exampleRevSharePct: "20%",
  },
] as const;

export const STORAGE_KEYS = {
  affiliateHandle: "synexus-affiliate-handle",
} as const;

export function normalizeAffiliateHandle(raw: string): string {
  return raw.trim().replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-_]/g, "");
}

/** Public referral URL: https://www.synexus.pro/ref/{handle} */
export function buildAffiliateReferralUrl(handle = ""): string {
  const base = PUBLIC_SITE_URL.replace(/\/$/, "");
  const normalized = normalizeAffiliateHandle(handle);
  if (!normalized) return `${base}/ref/your-handle`;
  return `${base}/ref/${encodeURIComponent(normalized)}`;
}

export function readStoredAffiliateHandle(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(STORAGE_KEYS.affiliateHandle) ?? "";
}

export function saveAffiliateHandle(handle: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.affiliateHandle, handle);
}
