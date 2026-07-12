/**
 * Titan product guidelines — the experience goal:
 * "I don't use Synexus. I ask Titan."
 *
 * Synexus is the platform; Titan is the commander users talk to.
 * These rules govern copy, behavior, and future feature work.
 */

export const TITAN_PRODUCT_TAGLINE = "Don't use Synexus — ask Titan.";

export const TITAN_PRODUCT_VISION =
  "Titan is the operator's AI commander: she talks about anything you bring her — markets, decisions, " +
  "strategy, life — while grounding crypto questions in live Synexus data. She coaches; you stay in control.";

export function buildTitanIdentityLine(titanBotName: string): string {
  return (
    `I'm ${titanBotName} — your intelligence commander. ` +
    `Talk to me about anything — coins, risk, plans, or what's on your mind. I analyze live data when it matters; you stay in control.`
  );
}

export function buildTitanCapabilityBlurb(titanBotName: string): string {
  return (
    `${titanBotName} connects to live markets, flags scams, coaches your decisions, remembers your style when you opt in, ` +
    `and holds real conversations — not just menus. ${TITAN_GUARDRAILS.disclaimer}`
  );
}

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
      "Titan connects to live crypto market data and an LLM brain to explain price moves, monitor trends, and answer using current information — not static scripts.",
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
    title: "Scam, security & privacy",
    summary:
      "Sentinel Aegis guards tokens and your operator account — suspicious contracts, rug signals, phishing awareness, and privacy-safe sign-in. Titan explains the read; Aegis runs the lane.",
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
  "Here's my read — then you decide.",
  "I'll give you a straight answer from the data.",
  "Let me break down the risk and momentum — your call from there.",
] as const;
