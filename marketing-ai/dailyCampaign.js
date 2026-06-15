#!/usr/bin/env node
/**
 * Synexus Daily Campaign — one command, all platforms.
 *
 *   node dailyCampaign.js              # today: copy + video + post everywhere configured
 *   node dailyCampaign.js --watch      # run at startup + every local midnight
 *   node dailyCampaign.js --force      # re-post / re-render today
 *
 * Platforms:
 *   YouTube  — auto upload (YOUTUBE_*)
 *   Telegram — auto post (TELEGRAM_BOT_TOKEN)
 *   Discord  — auto post (DISCORD_BOT_TOKEN + channel)
 *   Reddit   — auto post (REDDIT_* + subreddit)
 *   TikTok   — exports video + caption; API if TIKTOK_ACCESS_TOKEN set
 */

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMarketingEnv } from "./loadEnv.js";
import { buildDailyPack, writePack, todayDirName, generateTikTokCaption } from "./synexusMarketingBot.js";
import { renderDailyVideo } from "./makeVideo.js";
import { hasYouTubeCredentials, uploadVideoToYouTube } from "./youtubeUpload.js";
import { readCampaignState, writeCampaignState, wasPosted } from "./campaignState.js";
import { hasTelegramConfig, postTelegram } from "./platforms/telegram.js";
import { hasDiscordConfig, postDiscord } from "./platforms/discord.js";
import { hasRedditConfig, postReddit } from "./platforms/reddit.js";
import { publishTikTok } from "./platforms/tiktok.js";
import { msUntilNextLocalMidnight, parseArgs } from "./videoUtils.js";

loadMarketingEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));

function outputRoot() {
  return process.env.VIDEO_OUTPUT_DIR?.trim() || join(__dirname, "output");
}

async function runPlatform(name, fn, { force, state, quiet }) {
  if (wasPosted(state, name) && !force) {
    if (!quiet) console.log(`  ↷ ${name}: already done today`);
    return state.platforms[name];
  }
  try {
    const result = await fn();
    state.platforms[name] = { ...result, postedAt: new Date().toISOString() };
    return state.platforms[name];
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    state.platforms[name] = { error: message, at: new Date().toISOString() };
    console.error(`  ✗ ${name}: ${message}`);
    return null;
  }
}

export async function runDailyCampaign({ force = false, quiet = false } = {}) {
  const date = todayDirName();
  const dayDir = join(outputRoot(), date);

  if (!quiet) {
    console.log(`\nSynexus Daily Campaign · ${date}`);
    console.log("═".repeat(48));
  }

  const pack = buildDailyPack();
  await writePack(pack, { quiet: true });

  let state = await readCampaignState(dayDir);
  if (!state.platforms) state.platforms = {};

  if (!quiet) console.log("\n1/5 Rendering daily video…");
  await renderDailyVideo({ force, quiet: true });

  const videoPath = join(dayDir, "synexus-daily.mp4");
  const metadataPath = join(dayDir, "youtube-upload.txt");
  const tiktokCaption = generateTikTokCaption();

  if (!quiet) console.log("\n2/5 Publishing…");

  if (hasYouTubeCredentials()) {
    await runPlatform(
      "youtube",
      () => uploadVideoToYouTube({ videoPath, metadataPath, dayDir, force, quiet: true }),
      { force, state, quiet },
    );
  } else if (!quiet) {
    console.log("  ↷ youtube: not configured");
  }

  if (hasTelegramConfig()) {
    await runPlatform(
      "telegram",
      () =>
        postTelegram(pack.telegram, {
          quiet: true,
          photoPath: join(dayDir, "syn-bunny.png"),
        }),
      { force, state, quiet },
    );
  } else if (!quiet) {
    console.log("  ↷ telegram: TELEGRAM_BOT_TOKEN not set");
  }

  if (hasDiscordConfig()) {
    await runPlatform("discord", () => postDiscord(pack.discord, { quiet: true }), {
      force,
      state,
      quiet,
    });
  } else if (!quiet) {
    console.log("  ↷ discord: DISCORD_BOT_TOKEN not set");
  }

  if (hasRedditConfig()) {
    await runPlatform("reddit", () => postReddit(pack.reddit, { quiet: true }), {
      force,
      state,
      quiet,
    });
  } else if (!quiet) {
    console.log("  ↷ reddit: set REDDIT_CLIENT_ID, REDDIT_REFRESH_TOKEN, REDDIT_SUBREDDIT");
  }

  if (!quiet) console.log("\n3/5 TikTok bundle…");
  await runPlatform(
    "tiktok",
    () => publishTikTok({ dayDir, videoPath, caption: tiktokCaption, quiet: true }),
    { force, state, quiet },
  );

  state.date = date;
  state.dayDir = dayDir;
  await writeCampaignState(dayDir, state);

  if (!quiet) {
    console.log("\n4/5 Campaign log →", join(dayDir, "campaign.json"));
    console.log("\n✓ Daily campaign complete");
    summarize(state);
  }

  return { dayDir, state, pack };
}

function summarize(state) {
  const lines = [];
  for (const [name, info] of Object.entries(state.platforms || {})) {
    if (info.error) lines.push(`  ${name}: failed — ${info.error}`);
    else if (info.url) lines.push(`  ${name}: ${info.url}`);
    else if (info.videoId) lines.push(`  ${name}: https://youtube.com/shorts/${info.videoId}`);
    else if (info.mode === "export") lines.push(`  ${name}: export ready`);
    else if (info.postedAt) lines.push(`  ${name}: posted`);
  }
  if (lines.length) console.log(lines.join("\n"));
}

function printHelp() {
  console.log(`Synexus Daily Campaign

  npm run campaign:daily          Run once (all configured platforms)
  npm run campaign:watch          Every day at midnight + now
  npm run campaign:daily -- --force   Re-post today

Configure marketing-ai/.env:
  APP_ORIGIN
  YOUTUBE_*           → YouTube Shorts (npm run youtube:auth)
  TELEGRAM_BOT_TOKEN  → Telegram channel
  TELEGRAM_CHAT_ID
  DISCORD_BOT_TOKEN   → Discord #marketing (npm run discord:channels)
  DISCORD_CHANNEL_ID  → or auto-find by DISCORD_MARKETING_CHANNEL name
  REDDIT_*            → Reddit posts (npm run reddit:auth)
  TIKTOK_ACCESS_TOKEN → optional API; otherwise exports video+caption

Windows Task Scheduler (daily 7 AM):
  node dailyCampaign.js
  Start in: ...\\marketing-ai
`);
}

async function runWatch() {
  const tick = async (label) => {
    try {
      console.log(`\n[${new Date().toLocaleString()}] ${label}`);
      await runDailyCampaign({ quiet: false });
    } catch (err) {
      console.error("[Synexus campaign]", err.message || err);
    }
  };

  await tick("Daily campaign");
  const schedule = () => {
    const wait = msUntilNextLocalMidnight();
    console.log(`Next campaign in ${Math.round(wait / 3600000)}h (local midnight).`);
    setTimeout(async () => {
      await tick("Midnight campaign");
      schedule();
    }, wait);
  };
  schedule();
}

async function main() {
  const { force, watch, quiet, help } = parseArgs(process.argv.slice(2));
  if (help) {
    printHelp();
    return;
  }

  if (watch) {
    await runWatch();
    return;
  }

  await runDailyCampaign({ force, quiet });
}

const isMain =
  process.argv[1] &&
  (fileURLToPath(import.meta.url) === process.argv[1].replace(/\\/g, "/") ||
    process.argv[1].endsWith("dailyCampaign.js"));

if (isMain) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
