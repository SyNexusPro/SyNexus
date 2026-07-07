/**
 * Titan product guidelines — the experience goal:
 * "I don't use Synexus. I ask Titan."
 *
 * Synexus is the platform; Titan is the commander users talk to.
 * These rules govern copy, behavior, and future feature work.
 */

export const TITAN_PRODUCT_TAGLINE = "Don't use Synexus — ask Titan.";

export const TITAN_PRODUCT_VISION =
  "Titan is the user's personal crypto intelligence commander: she explains live markets, " +
  "surfaces risk, coaches decisions, and learns (with permission) — never replacing the user's judgment.";

export type TitanCapabilityStatus = "live" | "beta" | "planned";

export type TitanCapability = {
  id: string;
  title: string;
  summary: string;
  requiresPermission: boolean;
  status: TitanCapabilityStatus;
};

/** Capability roadmap — implement against these IDs over time. */
export const TITAN_CAPABILITIES: readonly TitanCapability[] = [
  {
    id: "personalized_memory",
    title: "Personalized memory",
    summary:
      "With your permission, Titan remembers trading preferences, favorite coins, risk tolerance, and past conversations so she becomes more helpful over time.",
    requiresPermission: true,
    status: "beta",
  },
  {
    id: "realtime_markets",
    title: "Real-time market awareness",
    summary:
      "Titan connects to live crypto market data to explain price moves, monitor trends, and answer using current information — not static knowledge.",
    requiresPermission: false,
    status: "live",
  },
  {
    id: "portfolio_intelligence",
    title: "Portfolio intelligence",
    summary:
      "Connect a wallet so Titan can analyze holdings, flag concentration risk, track gains and losses, and point out potential issues.",
    requiresPermission: true,
    status: "planned",
  },
  {
    id: "scam_security",
    title: "Scam & security analysis",
    summary:
      "Titan analyzes new tokens, warns about suspicious contracts, identifies rug-pull signals, and explains why something looks risky.",
    requiresPermission: false,
    status: "live",
  },
  {
    id: "trading_coach",
    title: "Trading coach",
    summary:
      "Instead of saying \"buy this,\" Titan explains indicators, sentiment, support and resistance, and helps you learn to decide for yourself.",
    requiresPermission: false,
    status: "live",
  },
  {
    id: "automation_alerts",
    title: "Smart alerts",
    summary:
      "Create alerts like \"Notify me if Bitcoin drops 5%,\" \"Alert me if whale wallets buy this token,\" or \"Tell me if liquidity changes dramatically.\"",
    requiresPermission: true,
    status: "planned",
  },
  {
    id: "voice",
    title: "Voice interaction",
    summary: "Talk to Titan naturally — not only typing.",
    requiresPermission: false,
    status: "live",
  },
  {
    id: "continuous_improvement",
    title: "Continuous improvement",
    summary:
      "Optional anonymous feedback (with consent) shows which answers helped and where Titan needs to improve.",
    requiresPermission: true,
    status: "beta",
  },
] as const;

export const TITAN_GUARDRAILS = {
  /** Never present guaranteed profits or exact buy/sell orders as advice. */
  noDefinitiveFinancialRecommendations: true,
  /** Provide analysis, explain risks, help users make informed decisions. */
  coachNotCommand: true,
  noGuaranteedProfits: true,
  noExactBuySellOrders: true,
  alwaysNonCustodial: true,
  disclaimer:
    "Not financial advice. Titan provides analysis and education — you sign every trade in your own wallet.",
} as const;

/** Short lines Titan may use when users ask for guaranteed picks. */
export const TITAN_COACH_REDIRECTS = [
  "I won't tell you exactly what to buy — I can break down risk, momentum, and wallet signals so you decide.",
  "No guarantees here. I'll explain what the data shows and what could go wrong — your call from there.",
  "I'm your coach, not a signal service. Ask me to scan a token, explain a rug flag, or walk through an indicator.",
] as const;

export function buildTitanIdentityLine(titanBotName: string): string {
  return (
    `I'm ${titanBotName} — your intelligence commander. ` +
    `Ask me about any coin, risk, or market read. I analyze live data and explain it — you stay in control.`
  );
}

export function buildTitanCapabilityBlurb(titanBotName: string): string {
  return (
    `${titanBotName} scans live markets, flags scams, coaches your decisions, and learns your style when you opt in. ` +
    TITAN_GUARDRAILS.disclaimer
  );
}
