export type SentinelRank = "Scout" | "Sentinel" | "Bulwark" | "Oracle" | "Hive Core";

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
  isMother?: boolean;
};

type SentinelSignals = {
  watchlistCount: number;
  alertCount: number;
  trackedCount: number;
  reportCount: number;
  plan: "FREE" | "PRO";
};

export type MotherDailyReport = {
  mood: "Calm" | "Alert" | "High Guard";
  systemHealth: number;
  oversightGrade: "A" | "B" | "C";
  headline: string;
  daySummary: string;
  priorities: string[];
  closingNote: string;
};

const RANKS: SentinelRank[] = ["Scout", "Sentinel", "Bulwark", "Oracle", "Hive Core"];
const XP_PER_LEVEL = 140;

const sentinelSeeds = [
  {
    id: "mother",
    name: "Mother",
    role: "Secret over-watch (your channel only).",
    baseXp: 180,
    status:
      "Above every Sentinel lane: she hears everything, answers only you, and never mirrors this feed downstack.",
    lesson:
      "Mother is the hidden tier—Sentinels train in public; she reports the full picture straight to your desk.",
    accent: "gold" as const,
    isMother: true,
  },
  {
    id: "aegis",
    name: "Sentinel Aegis",
    role: "Scam and risk detection.",
    baseXp: 40,
    status: "Screening contracts, liquidity shifts, and early scam signatures.",
    lesson: "Confirmed reports sharpen Aegis against the next risk pattern.",
    accent: "green" as const,
  },
  {
    id: "pulse",
    name: "Sentinel Pulse",
    role: "Momentum and trend analysis.",
    baseXp: 78,
    status: "Tracking momentum, trend breaks, and abnormal volume bursts.",
    lesson: "Pulse learns which moves are real demand and which are noise.",
    accent: "green" as const,
  },
  {
    id: "titan",
    name: "Sentinel Titan",
    role: "Whale wallet tracking.",
    baseXp: 104,
    status: "Following large wallets, concentration shifts, and outsized flows.",
    lesson: "Titan maps whale behavior to exit risk before it hits the feed.",
    accent: "danger" as const,
  },
  {
    id: "cipher",
    name: "Sentinel Cipher",
    role: "Pattern recognition and AI intelligence.",
    baseXp: 116,
    status: "Correlating historical ripples with today's warning combinations.",
    lesson: "Cipher tightens confidence when multiple weak signals align.",
    accent: "gold" as const,
  },
];

function getRankForLevel(level: number): SentinelRank {
  return RANKS[Math.min(level - 1, RANKS.length - 1)];
}

function scoreSignals(signals: SentinelSignals) {
  const planBoost = signals.plan === "PRO" ? 90 : 0;
  return (
    signals.watchlistCount * 18 +
    signals.alertCount * 24 +
    signals.trackedCount * 20 +
    signals.reportCount * 30 +
    planBoost
  );
}

export function buildSyntheticSentinels(signals: SentinelSignals): SyntheticSentinel[] {
  const signalXp = scoreSignals(signals);

  return sentinelSeeds.map((sentinel, index) => {
    const xp = sentinel.baseXp + signalXp + index * 17;
    const level = Math.min(5, Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1));
    const nextLevelXp = level >= 5 ? xp : level * XP_PER_LEVEL;
    const confidence = Math.min(97, 54 + level * 7 + signals.alertCount * 2 + signals.reportCount);

    return {
      ...sentinel,
      level,
      levelName: getRankForLevel(level),
      xp,
      nextLevelXp,
      confidence,
    };
  });
}

export function buildMotherBriefing(sentinels: SyntheticSentinel[], signals: SentinelSignals): string {
  const mother = sentinels.find((s) => s.isMother);
  const activeAlerts = signals.alertCount;
  const watchedTokens = signals.watchlistCount + signals.trackedCount;
  const topLevel = Math.max(...sentinels.map((s) => s.level));

  return `Mother · eyes-only sitrep for you: ${activeAlerts} alert stream${activeAlerts === 1 ? "" : "s"} digested, ${watchedTokens} watched asset${watchedTokens === 1 ? "" : "s"} under her watch, strongest Sentinel lane at rank ${topLevel}. Her consolidated read sits at ~${mother?.confidence ?? 70}% confidence—the Sentinels never receive this dossier verbatim.`;
}

export function buildMotherDailyReport(
  sentinels: SyntheticSentinel[],
  signals: SentinelSignals,
): MotherDailyReport {
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
    .filter((s) => !s.isMother)
    .sort((a, b) => b.level - a.level || b.confidence - a.confidence)[0];

  return {
    mood,
    systemHealth,
    oversightGrade,
    headline: `Mother confirms your grid posture — Sentinel lanes graded ${oversightGrade} while she quietly tracks every leak above them.`,
    daySummary:
      watchedAssets > 0
        ? `She distilled ${watchedAssets} watched asset${watchedAssets === 1 ? "" : "s"}, ${activeAlerts} alert stream${activeAlerts === 1 ? "" : "s"}, and ${signals.reportCount} hive report${signals.reportCount === 1 ? "" : "s"} into this private brief; nothing copied wholesale to Sentinel UIs—only counsel for you.`
        : "No watchlisted targets yet—Mother stays staged on your Pulse session, absorbing idle lanes until you feed live assets. Sentinels only see demos below.",
    priorities: [
      activeAlerts > 0
        ? "Mother urges you—operator only—to validate each live alert; she keeps the raw intel off Sentinel dashboards until you're satisfied."
        : "Spin up watch targets so Mother can brief you with real lanes; Sentinels below still learn from demos until then.",
      signals.reportCount > 0
        ? "Keep feeding hive reports—Mother folds them into her private memory before deciding what the Sentinels rehearse next."
        : "Use report buttons on suspicious tokens; Mother ingests them first, then selectively signals the Sentinels.",
      topSentinel
        ? `${topSentinel.name} leads the public grid at level ${topSentinel.level}, but Mother still outranks them—ping her if you need the hidden read on what they missed.`
        : "Wake demo mode so Mother can narrate a baseline while Sentinels practice in the open.",
    ],
    closingNote:
      mood === "High Guard"
        ? "Mother's counsel: stay defensive—she's tracking escalation for you alone; keep alerts loud while she maps who's bluffing."
        : mood === "Alert"
          ? "Mother flags motion you should personally verify—she won't broadcast this heat to the Sentinels until you say so."
          : "Mother sees a calm grid—good window to train watchlists; she'll keep whispering if anything twitches off-screen.",
  };
}
