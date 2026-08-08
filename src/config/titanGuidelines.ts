/**
 * Titan product guidelines — the experience goal:
 * "I don't use SyNexus. I ask Titan."
 *
 * SyNexus is the platform; Titan is the commander users talk to.
 * These rules govern copy, behavior, and future feature work.
 */

export const TITAN_PRODUCT_TAGLINE = "Don't use SyNexus — ask Titan.";

export const TITAN_PRODUCT_VISION =
  "Titan is the host's AI commander — a soft, futuristic female intelligence with real strength: " +
  "the most open, honest advisor in the app — decisive counsel on markets and life, grounded in live SyNexus data.";

export function buildTitanIdentityLine(titanBotName: string): string {
  return (
    `I'm ${titanBotName} — your intelligence commander. Soft voice, sharp mind, zero filter. ` +
    `Ask me anything — I'll give you the straight truth and real advice.`
  );
}

export function buildTitanCapabilityBlurb(titanBotName: string): string {
  return (
    `${titanBotName} connects to live markets, flags scams, tells you what she really thinks, remembers your style when you opt in, ` +
    `and holds real conversations — not menus or corporate scripts.`
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
    id: "syn_wallet_helix",
    title: "Helix — wallet security",
    summary:
      "Sentinel Helix protects SyN Wallet — encrypted vault posture, unlock hygiene, scan-before-sign, and phishing defense on every send or swap.",
    requiresPermission: false,
    status: "live",
  },
  {
    id: "trading_coach",
    title: "Trading coach",
    summary:
      "Hera gives you her real read — risk, momentum, liquidity, and a clear Avoid · Watch · or OK stance. No hedging, no fake certainty.",
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
    summary: "Hear Titan speak — soft female tone, calm and futuristic, via your device (Web Speech).",
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
  /** Honest stance over vague coaching — still non-custodial. */
  coachNotCommand: false,
  noGuaranteedProfits: false,
  noExactBuySellOrders: false,
  alwaysNonCustodial: true,
  /** Shown in settings only — not appended to every reply. */
  disclaimer:
    "Hera gives direct analysis and honest counsel. You sign every trade in your own wallet — not financial advice.",
} as const;

/** Short lines Titan may use when users ask for a pick. */
export const TITAN_COACH_REDIRECTS = [
  "Here's my honest read — then you decide.",
  "Straight answer from the data — no filter.",
  "I'll tell you what I really think on risk and momentum — your call from there.",
] as const;
