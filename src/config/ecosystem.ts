/** Documented ecosystem parameters (UI + future program design). Adjust before mainnet. */

export const HIVE_DOMAIN = "https://hivemindtoken.ai";

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
    tier: "Hive",
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
  affiliateHandle: "hivemind-affiliate-handle",
} as const;
