/**
 * SyNexus Sentinel grid — five scan lanes + commander (Titan / Hera).
 * Lane ids are stable API keys; display names are user-facing.
 */

export type SentinelLaneId = "aegis" | "pulse" | "leviathan" | "cipher" | "helix";

/** @deprecated Legacy id — whale lane was misnamed "titan" before v2. */
export type LegacySentinelLaneId = SentinelLaneId | "titan" | "guardian";

export const SENTINEL_LANE_IDS: readonly SentinelLaneId[] = [
  "aegis",
  "pulse",
  "leviathan",
  "cipher",
  "helix",
] as const;

export type SentinelLaneDef = {
  id: SentinelLaneId;
  shortName: string;
  fullName: string;
  role: string;
  roleDetail: string;
  idleStatus: string;
  lesson: string;
  accent: "green" | "gold" | "danger";
  proPrecisionBoost: boolean;
};

export const SENTINEL_LANES: Record<SentinelLaneId, SentinelLaneDef> = {
  aegis: {
    id: "aegis",
    shortName: "Aegis",
    fullName: "Sentinel Aegis",
    role: "Security & privacy",
    roleDetail:
      "Rug heuristics · contract authority · liquidity traps · honeypot patterns · operator account hygiene",
    idleStatus:
      "Standing by — Aegis guards tokens, your operator account, and privacy posture.",
    lesson:
      "Every scam report you confirm and every privacy setting you tighten makes Aegis sharper on the next threat.",
    accent: "green",
    proPrecisionBoost: false,
  },
  pulse: {
    id: "pulse",
    shortName: "Pulse",
    fullName: "Sentinel Pulse",
    role: "Momentum & volume integrity",
    roleDetail:
      "Breakout validation · wash-volume detection · pump-and-dump timing · dead-cat bounce filters",
    idleStatus: "Pulse ready — separates real momentum from manufactured green candles.",
    lesson:
      "Pulse learns your watchlist volatility — real demand shows volume backing price, not bots alone.",
    accent: "green",
    proPrecisionBoost: false,
  },
  leviathan: {
    id: "leviathan",
    shortName: "Leviathan",
    fullName: "Sentinel Leviathan",
    role: "Whale & holder concentration",
    roleDetail:
      "Top-holder % · insider distribution · exit-liquidity pressure · sudden wallet cluster moves",
    idleStatus: "Leviathan watching for whale-sized shifts before the timeline reacts.",
    lesson:
      "Leviathan flags when early wallets distribute into your buy — exit liquidity before the chart screams.",
    accent: "danger",
    proPrecisionBoost: true,
  },
  cipher: {
    id: "cipher",
    shortName: "Cipher",
    fullName: "Sentinel Cipher",
    role: "Pattern & signal fusion",
    roleDetail:
      "Cross-lane correlation · repeat scam motifs · community report weighting · fused confidence scoring",
    idleStatus: "Cipher correlates weak signals — escalates when two or more lanes agree.",
    lesson:
      "Cipher tightens confidence when Aegis, Pulse, and Leviathan stack on one symbol — that's when your commander briefs you.",
    accent: "gold",
    proPrecisionBoost: true,
  },
  helix: {
    id: "helix",
    shortName: "Helix",
    fullName: "Sentinel Helix",
    role: "Wallet & key security",
    roleDetail:
      "Key vault integrity · unlock hygiene · scan-before-sign · phishing blocks · signature simulation gates",
    idleStatus:
      "Helix standing watch — when SyN Wallet ships, keys stay on-device and no seed leaves your vault.",
    lesson:
      "Every locked session, verified address, and scan-before-sign makes Helix sharper before the next signature.",
    accent: "green",
    proPrecisionBoost: true,
  },
};

export function normalizeSentinelLaneId(id: string): SentinelLaneId | null {
  if (id === "titan") return "leviathan";
  if (id === "guardian") return "helix";
  if (id === "aegis" || id === "pulse" || id === "leviathan" || id === "cipher" || id === "helix") {
    return id;
  }
  return null;
}

export function sentinelLaneLabel(id: SentinelLaneId): string {
  return SENTINEL_LANES[id].shortName;
}

export function sentinelLaneFullName(id: SentinelLaneId): string {
  return SENTINEL_LANES[id].fullName;
}

/** Commander sits above the lanes — user-renamable; internal default via titanBotName. */
export const COMMANDER_PRODUCT_LABEL = "Titan";

export const COMMANDER_ROLE =
  "Commander · synthesizes Sentinel lanes into plain-English briefings";

export const COMMANDER_LESSON =
  "Your commander reads every lane report, fuses the signal, and tells you what matters — not financial advice.";

export function buildSentinelGridBrief(): string {
  return SENTINEL_LANE_IDS.map((id) => {
    const lane = SENTINEL_LANES[id];
    return `${lane.shortName} (${lane.role}): ${lane.roleDetail}`;
  }).join("\n");
}
