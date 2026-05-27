#!/usr/bin/env node
/**
 * SyNexus Marketing Bot — template copy generator (CLI).
 * Mirrors hivemind-app Marketing Command generators; does not post anywhere.
 *
 * Usage:
 *   node synexusMarketingBot.js              # print full daily pack
 *   node synexusMarketingBot.js --write      # save pack to output/YYYY-MM-DD/
 *   node synexusMarketingBot.js --channel x  # one channel: x|tiktok|telegram|discord|reddit|referral|mission
 *   node synexusMarketingBot.js --watch      # refresh pack every hour
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TAGS = "#SyNexus #Solana #DeFi";
const TRIAL_LINE = "First month free · $19.99/mo after trial on Nexus Pro.";

const THEMES = [
  "Risk surfaces fast — SyNexus Sentinels and Mother Core distill it into signal, not hype.",
  "The Nexus aligns momentum scans, whale context, patterns, and risk — before the crowd piles in.",
  "AI market intelligence with discipline: Sentinel-grade analysis built for sober execution.",
];

function appOrigin() {
  return process.env.APP_ORIGIN?.trim() || "https://your-live-app-url.com";
}

function pickThemes(n, offset) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.push(THEMES[(offset + i) % THEMES.length]);
  }
  return out;
}

function salt(seed) {
  return ((seed * 9301 + 49297) % 233280) / 233280;
}

export function generateXPost(now = Date.now()) {
  const [t0, t1] = pickThemes(2, Math.floor(now / 60_000) % THEMES.length);
  return `${t0}\n${t1}\n${TRIAL_LINE}\n${TAGS}`;
}

export function generateTikTokScript(now = Date.now()) {
  const s = salt(Math.floor(now / 1000));
  const hook =
    s < 0.33
      ? "Hook: Freeze on a chart caption — VO: Moved already? SyNexus Sentinels scout before clicks."
      : s < 0.66
        ? "Hook: Pan your watchlist. VO: Loud feed, silent risks unless you Nexus-scan first."
        : "Hook: About to ape. Freeze. VO: Mother Core + Sentinels pass first — then you choose.";

  return [
    `SyNexus — ${hook}`,
    "",
    `[0–3s] Mention lanes: Sentinel Aegis (risk), Sentinel Pulse (momentum), Sentinel Titan (whales), Sentinel Cipher (patterns). Mother Core fuses lanes for operator clarity.`,
    `[3–8s] On-screen: Nexus Pro — unlimited Nexus intelligence. ${TRIAL_LINE}`,
    `[8–12s] Brief app/The Nexus visuals. Whale tracking · momentum cues · Sentinel analysis.`,
    `[12–15s] Soft CTA: Try SyNexus — link out. Tags: ${TAGS}`,
  ].join("\n");
}

export function generateTelegramUpdate(now = Date.now()) {
  const origin = appOrigin();
  return [
    "**SyNexus pulse · The Nexus**",
    "",
    pickThemes(1, Math.floor(now / 86_400_000))[0],
    "",
    "**Stack** · Sentinel analysis · risk scanning · whale + momentum overlays",
    `**Offer** · ${TRIAL_LINE}`,
    "",
    `**Live app** (paste when ready):\n${origin}`,
  ].join("\n");
}

export function generateDiscordPost(now = Date.now()) {
  const origin = appOrigin();
  const t = pickThemes(1, Math.floor(now / 45_000))[0];
  return [
    "**SyNexus daily · The Nexus live**",
    t,
    "",
    "Mother Core threads Sentinel outputs into one operator-grade read — no spam, structured lanes.",
    `**Nexus Pro** · unlimited Nexus intelligence. ${TRIAL_LINE}`,
    "",
    `**App** · ${origin}`,
  ].join("\n");
}

export function generateRedditPost(now = Date.now()) {
  const origin = appOrigin();
  const seed = Math.floor(now / 120_000);
  const title =
    seed % 3 === 0
      ? "[Showcase / Feedback] SyNexus command center — structuring Sentinel intelligence for SOL traders?"
      : seed % 3 === 1
        ? "Momentum vs noise — consolidated Nexus dashboards (SyNexus) vs scattered TG calls?"
        : "Anyone building calm risk overlays? SyNexus + Mother Core as a restrained alternative to hype raids.";

  const body = [
    "Posting as operator — sober feedback welcomed.",
    "",
    pickThemes(2, seed)[0],
    "",
    "**What SyNexus highlights** · Sentinel analysis across risk scanning, whale tracking, momentum detection, pattern reads — marketed as Nexus intelligence layered under The Nexus. Not financial advice, not guaranteed outcomes.",
    "",
    TRIAL_LINE,
    "",
    `Live demo / app · ${origin} (remove per subreddit rules if needed.)`,
  ].join("\n");

  return `TITLE:\n${title}\n\nBODY:\n${body}`;
}

export function generateReferralBlurb(now = Date.now()) {
  const origin = appOrigin();
  const line = pickThemes(1, Math.floor(now / 90_000))[0];
  return [
    "Invite disciplined traders into SyNexus — The Nexus is your mission console for Sentinel-scale intelligence.",
    line,
    "",
    "They're not handing out entries — they're surfacing Sentinel analysis, whales, momentum, and risk overlays so convictions stay deliberate.",
    "",
    TRIAL_LINE,
    "",
    origin,
  ].join("\n");
}

export function growthMissionLine(date = new Date()) {
  const missions = [
    "Post one short video showing Sentinels surfacing elevated risk **before** a sketchy ape.",
    "Carousel: Sentinel Aegis (risk lane) vs Sentinel Titan (whale lane) framed under The Nexus.",
    "Film a TikTok teaser: whale tracking spotted a suspicious flow ahead of chatter.",
    "X mini-thread (3 posts): disciplined momentum cues vs meme hype — stay factual, cite SyNexus.",
    "Share a Nexused UI clip (blur keys): describe what Mother Core would emphasize for traders.",
    "Telegram changelog tone: Nexus Pro intelligence after trial at $19.99/m — FAQs, disclaimers intact.",
    "Discord micro-post inviting feedback on Sentinel alert hygiene — futuristic, moderation-friendly.",
    "Reddit-ready voice clip contrasting Telegram alpha chaos vs one Nexus recap.",
    "Drop the SyNexus app link alongside a single sober reason Sentinel scanning matters.",
    'Stitch headline about a rug headline with “Sentinels would have waved earlier” framing — no sensationalism.',
    "Celebrate user feedback calmly — futuristic SyNexus social proof minus flex.",
    "Record a TikTok reacting to overstated influencer calls versus structured Sentinel reads.",
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

async function writePack(pack) {
  const dir = join(__dirname, "output", todayDirName());
  await mkdir(dir, { recursive: true });
  const files = {
    "mission.txt": pack.mission,
    "x-post.txt": pack.x,
    "tiktok-script.txt": pack.tiktok,
    "telegram-update.txt": pack.telegram,
    "discord-post.txt": pack.discord,
    "reddit-post.txt": pack.reddit,
    "referral-blurb.txt": pack.referral,
  };
  for (const [name, text] of Object.entries(files)) {
    await writeFile(join(dir, name), `${text}\n`, "utf8");
  }
  console.log(`Wrote pack → ${dir}`);
}

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
  console.log(`SyNexus Marketing Bot — copy templates only (no posting).

Commands:
  node synexusMarketingBot.js
  node synexusMarketingBot.js --write
  node synexusMarketingBot.js --channel x
  node synexusMarketingBot.js --watch

Channels: mission, x, tiktok, telegram, discord, reddit, referral

Env:
  APP_ORIGIN   Public app URL in social copy (see .env.example)
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
