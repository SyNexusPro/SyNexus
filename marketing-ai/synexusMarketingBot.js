#!/usr/bin/env node
/**
 * Synexus Marketing Bot — template copy generator (CLI).
 * Voice: simple, grabby, plain English. Lead with "Should I buy this?"
 *
 * Usage:
 *   node synexusMarketingBot.js              # print full daily pack
 *   node synexusMarketingBot.js --write      # save pack to output/YYYY-MM-DD/
 *   node synexusMarketingBot.js --channel x  # one channel
 *   node synexusMarketingBot.js --watch      # refresh pack every hour
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { mascotSignOff, mascotTelegramLine } from "./synBunny.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TAGS = "#Synexus #Solana #Crypto #ShouldIBuyThis";
const PRO_PRICE_LINE = "Synexus Pro · $19.99/month · cancel anytime.";

/** One-line hooks — rotate daily. Always lead with simplicity. */
const HOOKS = [
  "Should I buy this? Paste any Solana token. Synexus answers in seconds.",
  "About to ape? Paste the mint first. Avoid · Watch · OK — in plain English.",
  "One paste. One verdict. Risk, whales, and rug flags before you sign.",
  "Stop guessing. Paste a token — Synexus tells you if it's worth the click.",
  "Memecoin moving? Freeze. Paste it. Read Avoid or Watch before you buy.",
  "Trading Solana? Paste any coin. Get a simple scorecard + plain-English read.",
];

/** Supporting lines — still simple, no operator jargon. */
const SUPPORT = [
  "Free scan on every token. Pro unlocks Oracle briefings + full Sentinel grid.",
  "Your wallet signs every trade — Synexus just shows you the risk first.",
  "Trade journal tracks entries, exits, and P/L so you see your habits.",
  "Live alerts when whales move or risk spikes — before the timeline screams.",
  "Built for people who want one clear answer, not a wall of charts.",
];

function appOrigin() {
  return process.env.APP_ORIGIN?.trim() || "https://synexus.pro";
}

function pick(list, offset) {
  return list[offset % list.length];
}

function salt(seed) {
  return ((seed * 9301 + 49297) % 233280) / 233280;
}

function dayOffset(now) {
  return Math.floor(now / 86_400_000);
}

export function generateXPost(now = Date.now()) {
  const hook = pick(HOOKS, dayOffset(now));
  const support = pick(SUPPORT, dayOffset(now) + 1);
  return [
    hook,
    "",
    support,
    "",
    `Try free → ${appOrigin()}`,
    PRO_PRICE_LINE,
    TAGS,
  ].join("\n");
}

export function generateTikTokScript(now = Date.now()) {
  const hook = pick(HOOKS, dayOffset(now));
  const s = salt(Math.floor(now / 1000));
  const onScreen =
    s < 0.33
      ? "SHOULD I BUY THIS?"
      : s < 0.66
        ? "PASTE TOKEN → GET VERDICT"
        : "AVOID · WATCH · OK";

  return [
    `Synexus — Hook: Big text "${onScreen}" — VO: ${hook}`,
    "",
    `[0–3s] Show paste box + instant verdict card (Avoid / Watch / OK).`,
    `[3–7s] Flash scorecard: risk · whales · momentum · liquidity · rug warning.`,
    `[7–11s] One line: "Not financial advice — you still sign in your wallet."`,
    `[11–15s] Syn the bunny floats in corner. CTA: Try free · ${appOrigin()} · ${PRO_PRICE_LINE}`,
    "",
    `Tags: ${TAGS}`,
  ].join("\n");
}

export function generateTelegramUpdate(now = Date.now()) {
  const origin = appOrigin();
  const hook = pick(HOOKS, dayOffset(now));
  return [
    "**Should I buy this?**",
    "",
    hook,
    "",
    "**How it works**",
    "1️⃣ Paste a Solana mint or symbol",
    "2️⃣ Get **Avoid**, **Watch**, or **OK** + plain English",
    "3️⃣ See risk score, whales, rug flags — then you decide",
    "",
    "**Also inside** · trade journal · wallet stats · live alerts",
    "",
    `**Try free** → ${origin}`,
    PRO_PRICE_LINE,
    "",
    mascotTelegramLine(),
  ].join("\n");
}

export function generateDiscordPost(now = Date.now()) {
  const origin = appOrigin();
  const hook = pick(HOOKS, dayOffset(now));
  return [
    "**Should I buy this? — Synexus**",
    "",
    hook,
    "",
    "Paste any Solana token → **Avoid · Watch · OK** in plain English.",
    "Plus: risk scorecard, whale read, trade journal, and Sentinel alerts.",
    "",
    `**Try free** · ${origin}`,
    PRO_PRICE_LINE,
    "",
    mascotSignOff().replace(/\*\*/g, "**"),
  ].join("\n");
}

export function generateRedditPost(now = Date.now()) {
  const origin = appOrigin();
  const seed = dayOffset(now);
  const titles = [
    "I built a free \"Should I buy this?\" scanner for Solana — paste a mint, get Avoid/Watch/OK in plain English",
    "Before you ape: paste any SOL token and get a risk score + plain-English read (Synexus)",
    "Anyone else tired of TG hype? Made a simple Solana token scanner — paste → verdict → you decide",
  ];
  const title = pick(titles, seed);

  const body = [
    "Not shilling a coin — sharing a tool I use before every buy.",
    "",
    pick(HOOKS, seed),
    "",
    "**What it does (simple):**",
    "- Paste mint or symbol",
    "- Get Avoid, Watch, or OK + why in plain English",
    "- Risk score, whale activity, liquidity, rug-pull flags",
    "- Optional trade journal so you track wins/losses over time",
    "",
    "Non-custodial — your wallet signs every swap. Not financial advice.",
    "",
    PRO_PRICE_LINE,
    "",
    `Try it: ${origin}`,
    "",
    mascotSignOff().replace(/\*\*(.+?)\*\*/g, "$1"),
  ].join("\n");

  return `TITLE:\n${title}\n\nBODY:\n${body}`;
}

export function generateReferralBlurb(now = Date.now()) {
  const origin = appOrigin();
  const hook = pick(HOOKS, dayOffset(now));
  return [
    "Know someone who apes without checking risk?",
    "",
    hook,
    "",
    "Send them Synexus — paste a token, get a clear answer, trade on their own terms.",
    "",
    PRO_PRICE_LINE,
    "",
    origin,
  ].join("\n");
}

export function growthMissionLine(date = new Date()) {
  const missions = [
    'Post a 15s clip: paste a trending ticker → show the "Avoid" or "Watch" verdict on screen.',
    "Screen record: type BONK in Should I buy? — let the plain-English answer be the hook.",
    "TikTok text overlay: \"I paste every coin before I buy now.\" Show the scorecard.",
    "X thread (3 tweets): the problem (aping blind) → the fix (paste → verdict) → link.",
    "Telegram: ask \"What token should I scan live tomorrow?\" — engagement + demo.",
    "Discord: share one real Avoid verdict (blur ticker if needed) — educational not hype.",
    "Reddit comment helpfully: \"I use a paste-and-scan tool for risk — happy to show.\"",
    "Film wallet journal stats — people love seeing their own win rate.",
    "Compare: influencer \"100x gem\" vs Synexus Danger band on the same token.",
    "Short: \"3 seconds to paste. 5 seconds to know if you should touch it.\"",
    "Carousel: Avoid vs Watch vs OK — what each means in one sentence each.",
    "Story/Reel: Oracle one-liner + Should I buy? demo — keep it under 20 seconds.",
  ];
  const start = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const idx = Math.floor(start / 86_400_000) % missions.length;
  return missions[idx];
}

/** @returns {Record<string, string>} */
export function buildDailyPack(now = Date.now()) {
  return {
    mission: growthMissionLine(new Date(now)),
    x: generateXPost(now),
    tiktok: generateTikTokScript(now),
    telegram: generateTelegramUpdate(now),
    discord: generateDiscordPost(now),
    reddit: generateRedditPost(now),
    referral: generateReferralBlurb(now),
  };
}

export function generateTikTokCaption(now = Date.now()) {
  const hook = pick(HOOKS, dayOffset(now));
  return [
    hook,
    "",
    "Paste mint or symbol → Avoid · Watch · OK",
    "Risk · whales · rug flags · trade journal",
    "",
    `Free scan → ${appOrigin()}`,
    PRO_PRICE_LINE,
    "",
    "🐰 Syn the bunny · paste before you ape",
    "#Synexus #Solana #Crypto #Trading #Memecoin #ShouldIBuyThis #DeFi",
  ].join("\n");
}

export function parseRedditPost(text) {
  const titleMatch = String(text).match(/TITLE:\n([\s\S]*?)\n\nBODY:/);
  const bodyMatch = String(text).match(/BODY:\n([\s\S]*)/);
  return {
    title: titleMatch?.[1]?.trim() ?? "Should I buy this? — Synexus Solana scanner",
    body: bodyMatch?.[1]?.trim() ?? String(text),
  };
}

function todayDirName(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function printPack(pack) {
  const sections = [
    ["Today's growth mission", pack.mission],
    ["X post", pack.x],
    ["TikTok script", pack.tiktok],
    ["Telegram update", pack.telegram],
    ["Discord post", pack.discord],
    ["Reddit post", pack.reddit],
    ["Referral blurb", pack.referral],
  ];
  for (const [title, body] of sections) {
    console.log(`\n${"═".repeat(60)}\n${title}\n${"═".repeat(60)}\n`);
    console.log(body);
  }
  console.log(`\n${"─".repeat(60)}\nAPP_ORIGIN: ${appOrigin()}\n`);
}

async function writePack(pack, { quiet = false } = {}) {
  const dir = join(__dirname, "output", todayDirName());
  await mkdir(dir, { recursive: true });
  const tiktokCaption = generateTikTokCaption();
  const files = {
    "mission.txt": pack.mission,
    "x-post.txt": pack.x,
    "tiktok-script.txt": pack.tiktok,
    "tiktok-caption.txt": tiktokCaption,
    "telegram-update.txt": pack.telegram,
    "discord-post.txt": pack.discord,
    "reddit-post.txt": pack.reddit,
    "referral-blurb.txt": pack.referral,
  };
  for (const [name, text] of Object.entries(files)) {
    await writeFile(join(dir, name), `${text}\n`, "utf8");
  }
  if (!quiet) console.log(`Wrote pack → ${dir}`);
  return dir;
}

export { todayDirName, writePack, HOOKS, SUPPORT };

function parseArgs(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const channel = argv.find((a, i) => argv[i - 1] === "--channel" && !a.startsWith("--"));
  return {
    write: flags.has("--write"),
    watch: flags.has("--watch"),
    help: flags.has("--help") || flags.has("-h"),
    channel: channel?.toLowerCase(),
  };
}

function printHelp() {
  console.log(`Synexus Marketing Bot — copy templates only (no posting).

Commands:
  node synexusMarketingBot.js
  node synexusMarketingBot.js --write
  node synexusMarketingBot.js --channel telegram
  node synexusMarketingBot.js --watch

Channels: mission, x, tiktok, telegram, discord, reddit, referral

Env:
  APP_ORIGIN   Public app URL in social copy
`);
}

async function main() {
  const { write, watch, help, channel } = parseArgs(process.argv.slice(2));
  if (help) {
    printHelp();
    return;
  }

  const run = async () => {
    const now = Date.now();
    const pack = buildDailyPack(now);

    if (channel) {
      const key = channel === "mission" ? "mission" : channel;
      const text = pack[key];
      if (!text) {
        console.error(`Unknown channel "${channel}". Use: mission, x, tiktok, telegram, discord, reddit, referral`);
        process.exit(1);
      }
      console.log(text);
      if (write) {
        const dir = join(__dirname, "output", todayDirName());
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, `${key}.txt`), `${text}\n`, "utf8");
        console.log(`\nWrote → ${join(dir, `${key}.txt`)}`);
      }
      return;
    }

    printPack(pack);
    if (write) await writePack(pack);
  };

  await run();

  if (watch) {
    console.log("\nWatching — refresh every 60 minutes (Ctrl+C to stop).\n");
    setInterval(run, 60 * 60 * 1000);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1].replace(/\\/g, "/");
if (isMain || process.argv[1]?.endsWith("synexusMarketingBot.js")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
