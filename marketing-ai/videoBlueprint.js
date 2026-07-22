import { buildDailyPack, growthMissionLine, HOOKS } from "./synexusMarketingBot.js";
import { buildDailyVoiceover, buildYouTubeTitle, TRIAL_OFFER_SHORT } from "./marketingCopy.js";

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
    .replace(/SyNexus — /g, "")
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

/** Spoken narration — Sentinel authority, tight cadence. */
export function buildVoiceover(pack, now = Date.now()) {
  const hook = extractHook(pack.tiktok);
  return buildDailyVoiceover(hook);
}

export function buildYouTubeMetadata(pack, now = Date.now()) {
  const date = new Date(now);
  const hook = extractHook(pack.tiktok);
  const title = buildYouTubeTitle({ hook, id: todayDirName(date) });

  const description = [
    "SyNexus Sentinel — Solana risk reads before you sign.",
    "",
    hook,
    "",
    "Paste · Scan · Decide — non-custodial. You sign every trade.",
    "",
    `Free scan: ${appOrigin()}`,
    "",
    "Not financial advice.",
    "",
    "#SyNexus #Solana #ShouldIBuyThis #Crypto #Shorts #Trading",
  ].join("\n");

  const tags = [
    "SyNexus",
    "Should I buy this",
    "Solana",
    "crypto trading",
    "token scanner",
    "memecoin",
    "rug pull",
  ].join(", ");

  return { title, description, tags, hook, date: todayDirName(date) };
}

/** Four tight scenes — hook fast, no clutter. */
export function buildScenes(pack) {
  return [
    {
      id: "intro",
      kicker: "SyNexus",
      headline: "SHOULD I BUY THIS?",
      sub: "Paste · Scan · Decide",
      durationRatio: 0.22,
    },
    {
      id: "hook",
      kicker: "3 seconds",
      headline: "PASTE ANY TOKEN",
      sub: "Sentinel-grade risk read",
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
      sub: TRIAL_OFFER_SHORT,
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
