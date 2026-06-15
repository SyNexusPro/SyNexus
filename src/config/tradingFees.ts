/** Synexus trading fee tiers (100 bps = 1%). */
export const TRADING_FEE_BPS = {
  FREE: 10,
  PRO: 5,
} as const;

export type SynexusPlan = keyof typeof TRADING_FEE_BPS;

/** How trading-fee revenue is allocated (must sum to 100). */
export const TRADING_FEE_REVENUE_ALLOCATION = [
  {
    id: "liquidity",
    label: "SyNexus coin liquidity / treasury",
    pct: 50,
  },
  {
    id: "development",
    label: "Development and hosting",
    pct: 20,
  },
  {
    id: "marketing",
    label: "Marketing and user acquisition",
    pct: 15,
  },
  {
    id: "compliance",
    label: "Security audits and legal / compliance",
    pct: 10,
  },
  {
    id: "reserve",
    label: "Emergency reserve",
    pct: 5,
  },
] as const;

export type TradingFeeAllocationId = (typeof TRADING_FEE_REVENUE_ALLOCATION)[number]["id"];
