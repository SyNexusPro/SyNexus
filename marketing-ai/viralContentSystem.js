/**
 * SyNexus Viral Content System v1.0
 * CTR · retention · subs · signups · Pro conversions
 */

export const SYSTEM_VERSION = "1.0";

export const BRAND = {
  theme: "Electric purple · matte black · futuristic AI interface",
  matteBlack: "#000000",
  electricPurple: "#8b5cf6",
  neonPurple: "#c084fc",
  deepPurple: "#6d28d9",
  accentCyan: "#5ee7ff",
  substrate: "#0a0612",
  titleHighlight: "#e9d5ff",
  muted: "#a78bfa",
  danger: "#ff6b6b",
};

export const VIDEO_FORMULA = {
  shock: { startSec: 0, endSec: 3, label: "Shocking statement or question" },
  problem: { startSec: 3, endSec: 15, label: "Show the problem" },
  solution: { startSec: 15, endSec: 45, label: "Show the solution" },
  synexus: { startSec: 45, endSec: 90, label: "SyNexus solving it" },
  tease: { label: "One question or next-video tease" },
};

export const EDITING = {
  maxBeatSec: 2,
  retentionBeatSec: 7,
  xfadeSec: 0.35,
  minShortSec: 22,
  targetShortSec: 45,
  targetLongSec: 90,
};

export const SCHEDULE = {
  shortsPerDay: 3,
  longFormPerDay: 1,
  liveStreamPerWeek: 1,
  /** 3 Shorts + 1 long-form (long posts at hour 4) */
  postHours: [8, 12, 17, 20],
  shortSlots: 3,
  longSlot: 3,
};

export const METRICS = {
  targetCtrPct: 10,
  targetWatchTimePct: 60,
  targetReturningViewersPct: 20,
  videosFirstMonth: 100,
};

export const SHOCK_HOOKS = [
  "This crypto mistake costs people millions.",
  "Would AI have stopped this scam?",
  "I tested the smartest crypto assistant.",
  "This is how scammers trick thousands every day.",
  "Most traders miss this one step — and get wrecked.",
  "Can AI actually beat human traders?",
  "This mint was a trap. Here's how you'd know.",
  "The biggest crypto mistake beginners make.",
];

export const CURIOSITY_TITLES = [
  "This AI Found a Crypto Scam Before Anyone Else",
  "I Tested an AI Crypto Assistant for 30 Days",
  "The Biggest Crypto Mistake Beginners Make",
  "How Scammers Trick Thousands Every Day",
  "Can AI Actually Beat Human Traders?",
  "This Solana Token Was a Trap (AI Caught It)",
  "Would You Have Bought This Coin?",
  "I Let AI Scan My Next Trade — Here's What Happened",
];

export const THUMBNAIL_WORDS = [
  "SCAM ALERT",
  "AI WON",
  "DON'T BUY",
  "TOO LATE",
  "SAFE?",
  "RUG PULL",
  "WATCH OUT",
  "AI SCAN",
];

export const CTA_LINES = [
  "Download SyNexus and let the AI check your next coin.",
  "Paste your next mint in SyNexus — free scan.",
  "Try SyNexus before you sign your next trade.",
  "Let SyNexus read the risk before you ape.",
];

export const PROBLEMS = [
  "People ape the chart without scanning liquidity or whale wallets.",
  "Scammers launch fresh mints with fake volume every single day.",
  "Exit liquidity looks like a pump until you're holding the bag.",
  "Influencers shill coins they already plan to exit on you.",
  "Rug flags hide in wallet concentration — not on the candle chart.",
];

export const SOLUTIONS = [
  "You need a read before you connect your wallet — not after CT screams.",
  "Paste the mint. Get Avoid, Watch, or OK in plain English.",
  "AI fuses liquidity, whales, and rug patterns in seconds.",
  "One question: should I buy this? One answer. Then you decide.",
];

export const SYNEXUS_DEMO = [
  "Synexus scans any Solana token — non-custodial, you sign every trade.",
  "Four Sentinels fuse into one verdict: Avoid, Watch, or OK.",
  "Pro unlocks Oracle briefings and full Sentinel grid refresh.",
];

export const TEASES = [
  "Would you have bought this coin? Comment below.",
  "Next video: the pattern that repeats every rug season.",
  "What mint should I scan live next?",
  "Follow for daily Sentinel reads.",
];

export const VISUAL_ROTATION = ["glitch", "fear", "dashboard", "chart", "authority", "urgent", "fomo"];

export function pick(list, seed) {
  return list[Math.abs(seed) % list.length];
}

export function seedFrom(parts) {
  return String(parts).split("").reduce((n, c) => n + c.charCodeAt(0), 0);
}

export function primaryCta(seed = 0) {
  return pick(CTA_LINES, seed);
}

export function thumbnailText(seed = 0) {
  return pick(THUMBNAIL_WORDS, seed);
}

export function curiosityTitle(seed = 0) {
  return pick(CURIOSITY_TITLES, seed);
}

export function printSystemBrief() {
  console.log(`\n🎬 SyNexus Viral Content System v${SYSTEM_VERSION}\n`);
  console.log(`Mission: CTR · retention · subs · signups · Pro`);
  console.log(`Brand: ${BRAND.theme}`);
  console.log(`Schedule: ${SCHEDULE.shortsPerDay} Shorts + ${SCHEDULE.longFormPerDay} long-form / day`);
  console.log(`Editing: max ${EDITING.maxBeatSec}s per beat · xfade ${EDITING.xfadeSec}s`);
  console.log(`Targets: ${METRICS.targetCtrPct}% CTR · ${METRICS.targetWatchTimePct}% watch · ${METRICS.videosFirstMonth} videos/mo\n`);
}
