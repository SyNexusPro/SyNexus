import { buildDailyPack, growthMissionLine } from "./synexusMarketingBot.js";

const FEATURES = [
  { label: "Token scanner", sub: "Live Sentinel lanes" },
  { label: "Whale tracker", sub: "Titan concentration" },
  { label: "Risk score", sub: "0–100 + Safe / Warning / Danger" },
  { label: "Pulse alerts", sub: "Watchlist hits" },
  { label: "Oracle Supreme", sub: "AI trading briefings" },
];

function appOrigin() {
  return process.env.APP_ORIGIN?.trim() || "https://synexus.pro";
}

function todayDirName(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function stripStageDirections(text) {
  return String(text)
    .replace(/\*\*/g, "")
    .replace(/\[.+?\]/g, "")
    .replace(/SyNexus — /g, "")
    .replace(/Hook:\s*/gi, "")
    .replace(/VO:\s*/gi, "")
    .replace(/#\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHook(tiktok) {
  const first = String(tiktok).split("\n")[0] || "";
  const vo = first.split(" VO: ")[1];
  if (vo) return stripStageDirections(vo);
  return "Scan first. Execute when you are ready.";
}

function extractBodyLines(pack) {
  const raw = pack.x || pack.mission || "";
  const lines = String(raw)
    .split("\n")
    .map((l) => stripStageDirections(l))
    .filter(Boolean)
    .slice(0, 3);
  if (lines.length) return lines;
  return [
    "AI-powered Solana intelligence — Sentinels surface risk before the crowd reacts.",
    "Non-custodial. You sign every trade in your wallet.",
  ];
}

/** Spoken narration for TTS (no hashtags, no stage marks). */
export function buildVoiceover(pack, now = Date.now()) {
  const hook = extractHook(pack.tiktok);
  const body = extractBodyLines(pack)[0];
  const mission = stripStageDirections(growthMissionLine(new Date(now))).replace(/\./g, ".");

  return [
    "Welcome to Synexus.",
    "The future of Solana trading intelligence.",
    hook.endsWith(".") ? hook : `${hook}.`,
    body.endsWith(".") ? body : `${body}.`,
    "Token scanner. Whale tracker. Risk scores. Pulse alerts. Oracle Supreme AI.",
    "Subscribe to Synexus Pro for nineteen ninety-nine per month.",
    "Non-custodial. You control your funds.",
    "Visit synexus dot pro.",
    "Not financial advice. Trade at your own risk.",
    mission ? `${mission.split(".")[0]}.` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 2800);
}

export function buildYouTubeMetadata(pack, now = Date.now()) {
  const date = new Date(now);
  const hook = extractHook(pack.tiktok);
  const titleVariants = [
    `Synexus Daily · ${hook.slice(0, 52)}`,
    `Solana AI Intel · Synexus Sentinels · ${todayDirName(date)}`,
    `Scan Before You Ape · Synexus Pro · Daily Brief`,
  ];
  const title = titleVariants[date.getUTCDate() % titleVariants.length].slice(0, 95);

  const description = [
    "Synexus — AI-powered Solana trading intelligence.",
    "",
    hook,
    "",
    "◆ Token scanner · Sentinel lanes",
    "◆ Whale tracker · concentration alerts",
    "◆ Risk score · Safe / Warning / Danger",
    "◆ Pulse alerts · watchlist hits",
    "◆ Oracle Supreme · AI briefings",
    "",
    `Synexus Pro — $19.99/month: ${appOrigin()}/pulse`,
    "",
    "Non-custodial — you sign every trade in Phantom, Solflare, or your wallet.",
    "Not financial advice. Digital assets are high risk.",
    "",
    "#Synexus #Solana #Crypto #Trading #AI #DeFi #Shorts",
  ].join("\n");

  const tags = [
    "Synexus",
    "Solana",
    "crypto trading",
    "AI trading",
    "token scanner",
    "whale tracker",
    "risk score",
    "DeFi",
    "Phantom wallet",
    "crypto alerts",
  ].join(", ");

  return { title, description, tags, hook, date: todayDirName(date) };
}

/** Visual scenes for the short (durationRatio sums to ~1). */
export function buildScenes(pack) {
  const hook = extractHook(pack.tiktok);
  const bodyLines = extractBodyLines(pack);

  return [
    {
      id: "intro",
      kicker: "Synexus",
      headline: "THE FUTURE OF TRADING",
      sub: "AI Solana command center",
      durationRatio: 0.14,
    },
    {
      id: "hook",
      kicker: "Daily intel",
      headline: hook.length > 72 ? `${hook.slice(0, 69)}…` : hook,
      sub: "Sentinels · Oracle Supreme · Pulse",
      durationRatio: 0.18,
    },
    {
      id: "features",
      kicker: "Platform stack",
      headline: "Built for serious operators",
      features: FEATURES,
      durationRatio: 0.22,
    },
    {
      id: "body",
      kicker: "The read",
      headline: bodyLines[0] || "Scan first. Trade on your terms.",
      sub: bodyLines[1] || "Non-custodial · You sign every swap",
      durationRatio: 0.28,
    },
    {
      id: "cta",
      kicker: "Synexus Pro",
      headline: "$19.99/month",
      sub: "Full Sentinel intelligence · synexus.pro",
      durationRatio: 0.18,
    },
  ];
}

export function buildVideoJob(now = Date.now()) {
  const pack = buildDailyPack(now);
  return {
    pack,
    voiceover: buildVoiceover(pack, now),
    metadata: buildYouTubeMetadata(pack, now),
    scenes: buildScenes(pack),
    date: todayDirName(new Date(now)),
  };
}

export { todayDirName, FEATURES };
