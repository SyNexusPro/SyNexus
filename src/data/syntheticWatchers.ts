import { resolveInternalCommanderPersona } from "../lib/titanBotName";
import {
  AEGIS_LESSON,
  AEGIS_ROLE,
  AEGIS_SENTINEL_NAME,
} from "../config/sentinelAegis";
import {
  HELIX_LESSON,
  HELIX_ROLE,
  HELIX_SENTINEL_NAME,
} from "../config/sentinelHelix";
import {
  COMMANDER_LESSON,
  COMMANDER_ROLE,
  SENTINEL_LANES,
  type SentinelLaneId,
} from "../config/sentinels";

export type SentinelRank = "Scout" | "Sentinel" | "Bulwark" | "Oracle" | "SyNexus Core";

export type SyntheticSentinel = {
  id: string;
  laneId?: SentinelLaneId;
  name: string;
  role: string;
  level: number;
  levelName: SentinelRank;
  xp: number;
  nextLevelXp: number;
  confidence: number;
  status: string;
  lesson: string;
  accent: "green" | "gold" | "danger";
  /** Commander synthetic bot (user-renamable; default Hera). */
  isCommander?: boolean;
  /** @deprecated Use isCommander */
  isOracleSupreme?: boolean;
};

type SentinelSignals = {
  watchlistCount: number;
  alertCount: number;
  trackedCount: number;
  reportCount: number;
  plan: "FREE" | "PRO";
};

export type OracleSupremeDailyReport = {
  mood: "Calm" | "Alert" | "High Guard";
  systemHealth: number;
  oversightGrade: "A" | "B" | "C";
  headline: string;
  daySummary: string;
  priorities: string[];
  closingNote: string;
};

const RANKS: SentinelRank[] = ["Scout", "Sentinel", "Bulwark", "Oracle", "SyNexus Core"];
const XP_PER_LEVEL = 140;

const sentinelSeeds = [
  {
    id: "commander",
    name: resolveInternalCommanderPersona(),
    role: COMMANDER_ROLE,
    baseXp: 200,
    status:
      "Commands Aegis, Pulse, Leviathan, Cipher, and Helix — fuses their reports into one plain-English briefing.",
    lesson: COMMANDER_LESSON,
    accent: "gold" as const,
    isCommander: true,
  },
  {
    id: "aegis",
    laneId: "aegis" as const,
    name: AEGIS_SENTINEL_NAME,
    role: AEGIS_ROLE,
    baseXp: 52,
    status: SENTINEL_LANES.aegis.idleStatus,
    lesson: AEGIS_LESSON,
    accent: SENTINEL_LANES.aegis.accent,
  },
  {
    id: "pulse",
    laneId: "pulse" as const,
    name: SENTINEL_LANES.pulse.fullName,
    role: SENTINEL_LANES.pulse.role,
    baseXp: 90,
    status: SENTINEL_LANES.pulse.idleStatus,
    lesson: SENTINEL_LANES.pulse.lesson,
    accent: SENTINEL_LANES.pulse.accent,
  },
  {
    id: "leviathan",
    laneId: "leviathan" as const,
    name: SENTINEL_LANES.leviathan.fullName,
    role: SENTINEL_LANES.leviathan.role,
    baseXp: 118,
    status: SENTINEL_LANES.leviathan.idleStatus,
    lesson: SENTINEL_LANES.leviathan.lesson,
    accent: SENTINEL_LANES.leviathan.accent,
  },
  {
    id: "cipher",
    laneId: "cipher" as const,
    name: SENTINEL_LANES.cipher.fullName,
    role: SENTINEL_LANES.cipher.role,
    baseXp: 130,
    status: SENTINEL_LANES.cipher.idleStatus,
    lesson: SENTINEL_LANES.cipher.lesson,
    accent: SENTINEL_LANES.cipher.accent,
  },
  {
    id: "helix",
    laneId: "helix" as const,
    name: HELIX_SENTINEL_NAME,
    role: HELIX_ROLE,
    baseXp: 140,
    status: SENTINEL_LANES.helix.idleStatus,
    lesson: HELIX_LESSON,
    accent: SENTINEL_LANES.helix.accent,
  },
];

function getRankForLevel(level: number): SentinelRank {
  return RANKS[Math.min(level - 1, RANKS.length - 1)];
}

function scoreSignals(signals: SentinelSignals) {
  const planBoost = signals.plan === "PRO" ? 160 : 0;
  return (
    signals.watchlistCount * 24 +
    signals.alertCount * 30 +
    signals.trackedCount * 26 +
    signals.reportCount * 38 +
    planBoost
  );
}

function isCommanderSentinel(s: (typeof sentinelSeeds)[number]): boolean {
  return "isCommander" in s && !!s.isCommander;
}

export function buildSyntheticSentinels(
  signals: SentinelSignals,
  commanderName = resolveInternalCommanderPersona(),
): SyntheticSentinel[] {
  const signalXp = scoreSignals(signals);

  return sentinelSeeds.map((sentinel, index) => {
    const xp = sentinel.baseXp + signalXp + index * 17;
    const level = Math.min(5, Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1));
    const nextLevelXp = level >= 5 ? xp : level * XP_PER_LEVEL;
    const proBoost = signals.plan === "PRO" ? 14 : 0;
    const confidence = Math.min(
      99,
      64 + level * 9 + signals.alertCount * 2 + signals.reportCount * 3 + proBoost,
    );

    const name = isCommanderSentinel(sentinel) ? commanderName : sentinel.name;

    return {
      ...sentinel,
      name,
      isOracleSupreme: isCommanderSentinel(sentinel),
      level,
      levelName: getRankForLevel(level),
      xp,
      nextLevelXp,
      confidence,
    };
  });
}

export function oracleSupremeMoodLabel(mood: OracleSupremeDailyReport["mood"]): string {
  if (mood === "High Guard") return "High alert";
  if (mood === "Alert") return "Needs attention";
  return "Quiet markets";
}

export function buildOracleSupremeBriefing(
  sentinels: SyntheticSentinel[],
  signals: SentinelSignals,
  commanderName = resolveInternalCommanderPersona(),
): string {
  const commander = sentinels.find((s) => s.isCommander || s.isOracleSupreme);
  const confidence = commander?.confidence ?? 70;
  const activeAlerts = signals.alertCount;
  const watchedTokens = signals.watchlistCount + signals.trackedCount;
  const topSentinel = sentinels
    .filter((s) => !s.isCommander && !s.isOracleSupreme)
    .sort((a, b) => b.level - a.level || b.confidence - a.confidence)[0];
  const leadName = topSentinel
    ? topSentinel.name.replace(/^Sentinel /, "")
    : "your Sentinels";

  if (watchedTokens === 0 && activeAlerts === 0) {
    return `${commanderName} is online. Add tokens to your watchlist — ${commanderName} will command Aegis, Pulse, Leviathan, Cipher, and Helix, then brief you here.`;
  }

  if (activeAlerts === 0) {
    return `${commanderName} is monitoring ${watchedTokens} token${watchedTokens === 1 ? "" : "s"}. Nothing urgent — ${leadName} leads at level ${topSentinel?.level ?? 1}. Read: ${confidence}% confidence.`;
  }

  return `${commanderName} reviewed ${activeAlerts} alert${activeAlerts === 1 ? "" : "s"} across ${watchedTokens} watched token${watchedTokens === 1 ? "" : "s"}. ${leadName} on point at level ${topSentinel?.level ?? 1}. ${commanderName}'s call: ${confidence}% confidence — briefing below.`;
}

export function buildOracleSupremeDailyReport(
  sentinels: SyntheticSentinel[],
  signals: SentinelSignals,
  commanderName = resolveInternalCommanderPersona(),
): OracleSupremeDailyReport {
  const averageConfidence = Math.round(
    sentinels.reduce((total, s) => total + s.confidence, 0) / sentinels.length,
  );
  const activeAlerts = signals.alertCount;
  const watchedAssets = signals.watchlistCount + signals.trackedCount;
  const mood =
    activeAlerts >= 4 ? "High Guard" : activeAlerts >= 1 || signals.reportCount >= 2 ? "Alert" : "Calm";
  const systemHealth = Math.min(99, Math.max(55, averageConfidence + signals.trackedCount * 2));
  const oversightGrade = systemHealth >= 86 ? "A" : systemHealth >= 72 ? "B" : "C";
  const topSentinel = sentinels
    .filter((s) => !s.isCommander && !s.isOracleSupreme)
    .sort((a, b) => b.level - a.level || b.confidence - a.confidence)[0];
  const leadName = topSentinel ? topSentinel.name.replace(/^Sentinel /, "") : "your team";

  return {
    mood,
    systemHealth,
    oversightGrade,
    headline:
      watchedAssets > 0
        ? `Sentinel grid graded ${oversightGrade} today — ${commanderName} holds command above the lanes.`
        : `${commanderName} is ready — add watchlist tokens so the lanes have live targets.`,
    daySummary:
      watchedAssets > 0
        ? `${commanderName} fused ${watchedAssets} watched token${watchedAssets === 1 ? "" : "s"}, ${activeAlerts} alert${activeAlerts === 1 ? "" : "s"}, and ${signals.reportCount} community report${signals.reportCount === 1 ? "" : "s"} into your private briefing.`
        : `SyNexusPro unlocks ${commanderName}'s commander briefings: lane orders, fused reads, and which Sentinel moves first.`,
    priorities: [
      activeAlerts > 0
        ? `Review ${activeAlerts} live alert${activeAlerts === 1 ? "" : "s"} — ${commanderName} flagged them from the lane grid.`
        : `Add watchlist tokens so Aegis, Pulse, Leviathan, Cipher, and Helix scan real targets.`,
      signals.reportCount > 0
        ? "Keep submitting reports — Cipher weights community intel into fused confidence."
        : "Report suspicious tokens. Aegis and Cipher read those first. Helix watches SyN Wallet.",
      topSentinel
        ? `${leadName} is your strongest lane (level ${topSentinel.level}). Ask ${commanderName} for a fresh fused read anytime.`
        : "Build your watchlist — the commander establishes baseline, then the lanes execute.",
    ],
    closingNote:
      mood === "High Guard"
        ? `${commanderName}: play defense. Lanes are tracking escalation — keep alerts on until Cipher clears the stack.`
        : mood === "Alert"
          ? "Something moved across lanes. Verify before acting — your commander won't spam orders until you're ready."
          : `Markets look calm from ${commanderName}'s chair — good time to grow the watchlist.`,
  };
}
