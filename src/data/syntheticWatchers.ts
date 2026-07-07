import { DEFAULT_TITAN_BOT_NAME } from "../config/titanBot";
import {
  AEGIS_LESSON,
  AEGIS_ROLE,
  AEGIS_SENTINEL_NAME,
} from "../config/sentinelAegis";

export type SentinelRank = "Scout" | "Sentinel" | "Bulwark" | "Oracle" | "Synexus Core";

export type SyntheticSentinel = {
  id: string;
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
  /** Commander synthetic bot (user-renamable; default Titan). */
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

const RANKS: SentinelRank[] = ["Scout", "Sentinel", "Bulwark", "Oracle", "Synexus Core"];
const XP_PER_LEVEL = 140;

const sentinelSeeds = [
  {
    id: "titan-commander",
    name: DEFAULT_TITAN_BOT_NAME,
    role: "Commander · your private AI briefing officer",
    baseXp: 180,
    status:
      "Titan commands Aegis, Pulse, Leviathan, and Cipher — then tells you what matters in plain English.",
    lesson:
      "Titan is synthetic: your bot learns from every alert and report you feed Synexus, and makes calls in seconds.",
    accent: "gold" as const,
    isOracleSupreme: true,
  },
  {
    id: "aegis",
    name: AEGIS_SENTINEL_NAME,
    role: AEGIS_ROLE,
    baseXp: 48,
    status:
      "Guarding tokens and operator privacy — scams, rugs, contracts, liquidity, and account-safe sign-in.",
    lesson: AEGIS_LESSON,
    accent: "green" as const,
  },
  {
    id: "pulse",
    name: "Sentinel Pulse",
    role: "Momentum & trend reads",
    baseXp: 86,
    status: "Separating real breakouts from fake pumps and dead-cat bounces.",
    lesson: "Pulse gets sharper when you track volatile tokens — it learns what real demand looks like.",
    accent: "green" as const,
  },
  {
    id: "titan",
    name: "Sentinel Leviathan",
    role: "Whale & wallet tracking",
    baseXp: 112,
    status: "Watching large wallets, sudden concentration shifts, and exit pressure.",
    lesson: "Leviathan flags when whales move before the timeline catches up.",
    accent: "danger" as const,
  },
  {
    id: "cipher",
    name: "Sentinel Cipher",
    role: "Pattern & signal fusion",
    baseXp: 124,
    status: "Connecting today's warnings to past ripples so weak signals stack into real risk.",
    lesson: "Cipher tightens confidence when multiple lanes agree — that's when Titan escalates.",
    accent: "gold" as const,
  },
];

function getRankForLevel(level: number): SentinelRank {
  return RANKS[Math.min(level - 1, RANKS.length - 1)];
}

function scoreSignals(signals: SentinelSignals) {
  const planBoost = signals.plan === "PRO" ? 140 : 0;
  return (
    signals.watchlistCount * 22 +
    signals.alertCount * 28 +
    signals.trackedCount * 24 +
    signals.reportCount * 36 +
    planBoost
  );
}

export function buildSyntheticSentinels(
  signals: SentinelSignals,
  commanderName = DEFAULT_TITAN_BOT_NAME,
): SyntheticSentinel[] {
  const signalXp = scoreSignals(signals);

  return sentinelSeeds.map((sentinel, index) => {
    const xp = sentinel.baseXp + signalXp + index * 17;
    const level = Math.min(5, Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1));
    const nextLevelXp = level >= 5 ? xp : level * XP_PER_LEVEL;
    const proBoost = signals.plan === "PRO" ? 12 : 0;
    const confidence = Math.min(
      99,
      62 + level * 9 + signals.alertCount * 2 + signals.reportCount * 3 + proBoost,
    );

    const name = sentinel.isOracleSupreme ? commanderName : sentinel.name;

    return {
      ...sentinel,
      name,
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
  commanderName = DEFAULT_TITAN_BOT_NAME,
): string {
  const commander = sentinels.find((s) => s.isOracleSupreme);
  const confidence = commander?.confidence ?? 70;
  const activeAlerts = signals.alertCount;
  const watchedTokens = signals.watchlistCount + signals.trackedCount;
  const topSentinel = sentinels
    .filter((s) => !s.isOracleSupreme)
    .sort((a, b) => b.level - a.level || b.confidence - a.confidence)[0];
  const leadName = topSentinel
    ? topSentinel.name.replace(/^Sentinel /, "")
    : "your Sentinels";

  if (watchedTokens === 0 && activeAlerts === 0) {
    return `${commanderName} is online and waiting. Add tokens to your watchlist — ${commanderName} will command your Sentinels to watch them and brief you here.`;
  }

  if (activeAlerts === 0) {
    return `${commanderName} is monitoring ${watchedTokens} token${watchedTokens === 1 ? "" : "s"} for you. Nothing urgent right now — ${leadName} is leading the team at level ${topSentinel?.level ?? 1}. ${commanderName} is ${confidence}% confident in the read.`;
  }

  return `${commanderName} just reviewed ${activeAlerts} alert${activeAlerts === 1 ? "" : "s"} across ${watchedTokens} watched token${watchedTokens === 1 ? "" : "s"}. ${leadName} is on point at level ${topSentinel?.level ?? 1}. ${commanderName}'s call: ${confidence}% confidence — see your briefing below.`;
}

export function buildOracleSupremeDailyReport(
  sentinels: SyntheticSentinel[],
  signals: SentinelSignals,
  commanderName = DEFAULT_TITAN_BOT_NAME,
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
    .filter((s) => !s.isOracleSupreme)
    .sort((a, b) => b.level - a.level || b.confidence - a.confidence)[0];
  const leadName = topSentinel ? topSentinel.name.replace(/^Sentinel /, "") : "your team";

  return {
    mood,
    systemHealth,
    oversightGrade,
    headline:
      watchedAssets > 0
        ? `Your Sentinel team is graded ${oversightGrade} today — ${commanderName} is holding the line above them.`
        : `${commanderName} is ready — add watchlist tokens so ${commanderName} has live data to command with.`,
    daySummary:
      watchedAssets > 0
        ? `${commanderName} pulled together ${watchedAssets} watched token${watchedAssets === 1 ? "" : "s"}, ${activeAlerts} alert${activeAlerts === 1 ? "" : "s"}, and ${signals.reportCount} community report${signals.reportCount === 1 ? "" : "s"}. This briefing is for you only — the Sentinels don't see ${commanderName}'s full notes.`
        : `Synexus Pro gives you ${commanderName}'s private commander briefings: what ${commanderName} sees, what ${commanderName} recommends, and which Sentinel ${commanderName} sends first.`,
    priorities: [
      activeAlerts > 0
        ? `Review ${activeAlerts} live alert${activeAlerts === 1 ? "" : "s"} — ${commanderName} flagged them for you, not for the public feed.`
        : `Add tokens to your watchlist so ${commanderName} can assign Aegis, Pulse, Leviathan, and Cipher to real targets.`,
      signals.reportCount > 0
        ? "Keep submitting reports on shady tokens — your commander learns from every one and retrains the Sentinels."
        : "Tap Report on suspicious tokens. Your commander reads those first, then decides which Sentinel to sharpen.",
      topSentinel
        ? `${leadName} is your strongest lane right now (level ${topSentinel.level}). ${commanderName} still outranks them — ask for a fresh brief anytime.`
        : "Build your watchlist — your commander establishes a baseline, then the Sentinels execute.",
    ],
    closingNote:
      mood === "High Guard"
        ? `${commanderName}'s advice: play defense. ${commanderName} is tracking escalation for you — keep alerts on until the lane clears.`
        : mood === "Alert"
          ? "Something moved. Double-check before acting — your commander won't spam the Sentinels until you're ready."
          : `Markets look calm from ${commanderName}'s chair — good time to grow your watchlist. ${commanderName} will ping you the second that changes.`,
  };
}
