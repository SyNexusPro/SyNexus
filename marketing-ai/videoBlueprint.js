import { buildDailyPack, growthMissionLine, HOOKS } from "./synexusMarketingBot.js";

const FLOW_STEPS = [
  { label: "PASTE TOKEN", sub: "Mint or symbol — 3 seconds" },
  { label: "GET VERDICT", sub: "Avoid · Watch · OK" },
  { label: "YOU DECIDE", sub: "Risk · whales · rug flags" },
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
    .replace(/Synexus — /g, "")
    .replace(/Hook:\s*/gi, "")
    .replace(/VO:\s*/gi, "")
    .replace(/Big text "[^"]+" — /gi, "")
    .replace(/#\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHook(tiktok) {
  const first = String(tiktok).split("\n")[0] || "";
  const vo = first.split(" VO: ")[1];
  if (vo) return stripStageDirections(vo);
  const day = Math.floor(Date.now() / 86_400_000);
  return HOOKS[day % HOOKS.length];
}

/** Spoken narration — short, direct, grabby. */
export function buildVoiceover(pack, now = Date.now()) {
  const hook = extractHook(pack.tiktok);
  const shortHook = hook.split(".")[0]?.trim() || hook;

  return [
    "Should I buy this?",
    shortHook.endsWith(".") ? shortHook : `${shortHook}.`,
    "Paste any Solana token.",
    "Synexus answers in seconds — Avoid, Watch, or OK.",
    "Risk score. Whales. Rug flags. Before you sign.",
    "Try free at synexus dot pro.",
    "Not financial advice.",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 1200);
}

export function buildYouTubeMetadata(pack, now = Date.now()) {
  const date = new Date(now);
  const hook = extractHook(pack.tiktok);
  const titleVariants = [
    `Should I Buy This? · Synexus · ${todayDirName(date)}`,
    `Paste → Avoid or Watch · Synexus`,
    `Stop Aping Blind · Synexus · ${todayDirName(date)}`,
  ];
  const title = titleVariants[date.getUTCDate() % titleVariants.length].slice(0, 95);

  const description = [
    "Should I buy this? Paste any Solana token — get Avoid, Watch, or OK in plain English.",
    "",
    hook,
    "",
    "Paste · Scan · Decide",
    "",
    `Try free: ${appOrigin()}`,
    "",
    "Not financial advice. You control your funds.",
    "",
    "#Synexus #Solana #ShouldIBuyThis #Crypto #Shorts",
  ].join("\n");

  const tags = [
    "Synexus",
    "Should I buy this",
    "Solana",
    "crypto trading",
    "token scanner",
    "memecoin",
  ].join(", ");

  return { title, description, tags, hook, date: todayDirName(date) };
}

/** Four tight scenes — hook fast, no clutter. */
export function buildScenes(pack) {
  return [
    {
      id: "intro",
      kicker: "Synexus",
      headline: "SHOULD I BUY THIS?",
      sub: "Paste · Scan · Decide",
      durationRatio: 0.22,
    },
    {
      id: "hook",
      kicker: "3 seconds",
      headline: "PASTE ANY TOKEN",
      sub: "Plain English verdict",
      durationRatio: 0.28,
    },
    {
      id: "flow",
      kicker: "How it works",
      headline: "3 STEPS",
      steps: FLOW_STEPS,
      durationRatio: 0.28,
    },
    {
      id: "cta",
      kicker: "Free scan",
      headline: "synexus.pro",
      sub: "Pro $19.99/mo · cancel anytime",
      durationRatio: 0.22,
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

export { todayDirName, FLOW_STEPS as FEATURES };
