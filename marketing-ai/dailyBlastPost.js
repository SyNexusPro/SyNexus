#!/usr/bin/env node
/**
 * Synexus Marketing Blast — 3× daily across every video platform.
 *
 *   npm run blast:watch     # auto-post forever (9am · 2pm · 8pm)
 *   npm run blast:now       # post due slots now
 *
 * Platforms: Telegram · YouTube · TikTok · Facebook · Instagram · Discord · X export · Reddit (1×/day)
 */

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMarketingEnv } from "./loadEnv.js";
import { renderDailyVideo } from "./makeVideo.js";
import { todayDirName } from "./videoBlueprint.js";
import {
  buildDailyPack,
  generateTelegramCaptions,
  generateTikTokCaptions,
  generateFacebookCaptions,
  generateInstagramCaptions,
  generateXCaptions,
} from "./synexusMarketingBot.js";
import { readCampaignState, writeCampaignState } from "./campaignState.js";
import { hasTelegramConfig, postTelegram } from "./platforms/telegram.js";
import { hasYouTubeCredentials, uploadVideoToYouTube } from "./youtubeUpload.js";
import { hasTikTokApiConfig, publishTikTok } from "./platforms/tiktok.js";
import { publishFacebook, publishInstagram } from "./platforms/meta.js";
import { publishX } from "./platforms/xTwitter.js";
import { hasDiscordConfig, postDiscord } from "./platforms/discord.js";
import { hasRedditConfig, postReddit } from "./platforms/reddit.js";
import { exportAdCreatives } from "./adCreatives.js";
import { fileExists } from "./videoPipeline.js";
import { parseArgs } from "./videoUtils.js";
import {
  postsPerDay,
  postHours,
  slotLabel,
  msUntilNextSlot,
  currentSlotIndex,
} from "./scheduleUtils.js";

loadMarketingEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));

function outputRoot() {
  return process.env.VIDEO_OUTPUT_DIR?.trim() || join(__dirname, "output");
}

function platformKey(name, slot) {
  return slot === 0 ? name : `${name}-${slot}`;
}

function wasSlotPosted(state, name, slot) {
  const info = state?.platforms?.[platformKey(name, slot)];
  if (!info) return false;
  if (info.error) return false;
  return Boolean(
    info.postedAt ||
      info.videoId ||
      info.url ||
      info.publishId ||
      info.withVideo ||
      info.mediaId ||
      info.mode === "export",
  );
}

async function tryPlatform(name, fn, state, slot, force, quiet) {
  if (wasSlotPosted(state, name, slot) && !force) {
    if (!quiet) console.log(`  ↷ ${name} slot ${slot + 1}: done`);
    return;
  }
  try {
    const result = await fn();
    state.platforms[platformKey(name, slot)] = {
      ...result,
      slot,
      postedAt: new Date().toISOString(),
    };
    if (!quiet && result?.mode !== "export") {
      console.log(`  ✓ ${name} · slot ${slot + 1}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    state.platforms[platformKey(name, slot)] = { error: message, slot, at: new Date().toISOString() };
    console.error(`  ✗ ${name}: ${message}`);
  }
}

export async function runBlastSlot({ slot, force = false, quiet = false, launch = null } = {}) {
  const date = launch?.dayLabel || todayDirName();
  const dayDir = launch?.dayDir || join(outputRoot(), todayDirName());
  const videoPath = launch?.videoPath || join(dayDir, "synexus-daily.mp4");
  const metadataPath = launch?.metadataPath || join(dayDir, "youtube-upload.txt");

  let state = await readCampaignState(dayDir);
  if (!state.platforms) state.platforms = {};

  if (!quiet) {
    const label = launch?.scriptId ? `${launch.scriptId} · ` : "";
    console.log(`\nSynexus marketing blast · ${label}slot ${slot + 1}/${postsPerDay()} · ${slotLabel(slot)} · ${date}`);
    console.log("─".repeat(52));
  }

  if (!(await fileExists(videoPath))) {
    if (launch) {
      throw new Error(`Launch video missing: ${videoPath} — run launch:render first`);
    }
    if (!quiet) console.log("  Rendering video (green glow · female voice · Syn bunny)…");
    await renderDailyVideo({ force: false, quiet: true });
  }

  const pack = buildDailyPack();
  const count = postsPerDay();
  let tgCap;
  let ttCap;
  let fbCap;
  let igCap;
  let xCap;
  let redditPost = pack.reddit;

  if (launch?.captions) {
    tgCap = launch.captions.telegram;
    ttCap = launch.captions.tiktok;
    fbCap = launch.captions.facebook || launch.captions.tiktok;
    igCap = launch.captions.instagram || launch.captions.tiktok;
    xCap = launch.captions.x;
    redditPost = launch.captions.reddit || redditPost;
  } else {
    const telegramCaptions = generateTelegramCaptions(Date.now(), count);
    const tiktokCaptions = generateTikTokCaptions(Date.now(), count);
    const fbCaptions = generateFacebookCaptions(Date.now(), count);
    const igCaptions = generateInstagramCaptions(Date.now(), count);
    const xCaptions = generateXCaptions(Date.now(), count);

    tgCap = telegramCaptions[slot] || pack.telegram;
    ttCap = tiktokCaptions[slot] || tiktokCaptions[0];
    fbCap = fbCaptions[slot] || fbCaptions[0];
    igCap = igCaptions[slot] || igCaptions[0];
    xCap = xCaptions[slot] || pack.x;
  }

  await exportAdCreatives({
    dayDir,
    slot,
    captions: { facebook: fbCap, instagram: igCap },
    quiet: true,
  });

  if (hasTelegramConfig()) {
    await tryPlatform(
      "telegram",
      () => postTelegram(tgCap, { quiet: true, videoPath }),
      state,
      slot,
      force,
      quiet,
    );
  } else if (!quiet) console.log("  ↷ Telegram: TELEGRAM_BOT_TOKEN not set");

  if (hasYouTubeCredentials()) {
    await tryPlatform(
      "youtube",
      () =>
        uploadVideoToYouTube({
          videoPath,
          metadataPath,
          dayDir,
          force,
          quiet: true,
          slot,
          titleSuffix: slotLabel(slot),
        }),
      state,
      slot,
      force,
      quiet,
    );
  } else if (!quiet) console.log("  ↷ YouTube: npm run youtube:auth");

  await tryPlatform(
    "tiktok",
    () => publishTikTok({ dayDir, videoPath, caption: ttCap, slot, quiet: true }),
    state,
    slot,
    force,
    quiet,
  );

  await tryPlatform(
    "facebook",
    () => publishFacebook({ dayDir, videoPath, caption: fbCap, slot, quiet: !quiet }),
    state,
    slot,
    force,
    quiet,
  );

  await tryPlatform(
    "instagram",
    () => publishInstagram({ dayDir, videoPath, caption: igCap, slot, quiet: !quiet }),
    state,
    slot,
    force,
    quiet,
  );

  if (hasDiscordConfig()) {
    await tryPlatform(
      "discord",
      () => postDiscord(tgCap.replace(/\*\*/g, "**"), { videoPath, quiet: true }),
      state,
      slot,
      force,
      quiet,
    );
  } else if (!quiet) console.log("  ↷ Discord: DISCORD_BOT_TOKEN not set");

  await tryPlatform(
    "x",
    () => publishX({ dayDir, videoPath, caption: xCap, slot, quiet: !quiet }),
    state,
    slot,
    force,
    quiet,
  );

  if (slot === 0 && hasRedditConfig()) {
    await tryPlatform(
      "reddit",
      () => postReddit(redditPost, { quiet: true }),
      state,
      slot,
      force,
      quiet,
    );
  } else if (slot === 0 && !quiet && !hasRedditConfig()) {
    console.log("  ↷ Reddit: npm run reddit:auth");
  }

  state.date = date;
  state.dayDir = dayDir;
  await writeCampaignState(dayDir, state);

  if (!quiet) {
    console.log(`\n✓ Blast slot ${slot + 1} complete → ${dayDir}`);
    console.log(`  Upload checklist: upload-checklist${slot === 0 ? "" : `-slot${slot + 1}`}.txt`);
  }
  return state;
}

export async function runDueBlast({ force = false, quiet = false } = {}) {
  const count = postsPerDay();
  const slot = Math.max(0, currentSlotIndex());
  const results = [];

  if (slot < 0) {
    if (!quiet) {
      console.log(`No slot due yet — next at ${postHours().map((h) => `${h}:00`).join(", ")} local.`);
    }
    return results;
  }

  for (let s = 0; s <= slot && s < count; s += 1) {
    try {
      results.push(await runBlastSlot({ slot: s, force, quiet }));
    } catch (err) {
      console.error(`  ✗ Slot ${s + 1}: ${err.message || err}`);
    }
  }
  return results;
}

async function runWatch() {
  const tick = async (label) => {
    try {
      console.log(`\n[${new Date().toLocaleString()}] ${label}`);
      await runDueBlast({ quiet: false });
    } catch (err) {
      console.error("[Synexus blast]", err.message || err);
    }
  };

  console.log(`\nSynexus Marketing Blast · ${postsPerDay()}× daily at ${postHours().join(", ")}:00`);
  console.log("Telegram · YouTube · TikTok · Facebook · Instagram · Discord · X · Reddit");
  await tick("Startup — post any due slots");

  const schedule = () => {
    const wait = msUntilNextSlot();
    const next = new Date(Date.now() + wait);
    console.log(`Next blast at ${next.toLocaleString()} (in ${Math.round(wait / 60000)} min).`);
    setTimeout(async () => {
      await tick("Scheduled blast");
      schedule();
    }, wait);
  };
  schedule();
}

function printHelp() {
  console.log(`Synexus Marketing Blast — push Synexus everywhere

  npm run blast:watch       Auto-post 3× daily (all platforms)
  npm run blast:now         Post due slots now
  npm run blast:force       Re-post everything due today

Platforms per slot:
  Telegram (video) · YouTube Shorts · TikTok · Facebook · Instagram Reels
  Discord · X export · Reddit (once/day morning slot)

Setup once:
  npm run youtube:auth
  npm run meta:auth        Facebook + Instagram
  npm run tiktok:auth
  npm run reddit:auth
  Set TELEGRAM_BOT_TOKEN + DISCORD_BOT_TOKEN in marketing-ai/.env

Schedule: POST_HOURS=9,14,20
`);
}

async function main() {
  const argv = process.argv.slice(2);
  const { force, watch, help, quiet } = parseArgs(argv);
  const slotFlag = argv.find((a) => a.startsWith("--slot="));
  const slotIdx = argv.indexOf("--slot");

  if (help) {
    printHelp();
    return;
  }

  if (watch) {
    await runWatch();
    return;
  }

  if (slotFlag || slotIdx !== -1) {
    const slot = Number(slotFlag?.slice("--slot=".length) ?? argv[slotIdx + 1]);
    await runBlastSlot({ slot: Number.isFinite(slot) ? slot : 0, force, quiet });
    return;
  }

  await runDueBlast({ force, quiet });
}

const isMain =
  process.argv[1] &&
  (fileURLToPath(import.meta.url) === process.argv[1].replace(/\\/g, "/") ||
    process.argv[1].endsWith("dailyTriplePost.js") ||
    process.argv[1].endsWith("dailyBlastPost.js"));

if (isMain) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  });
}

// Back-compat aliases
export { runBlastSlot as runTriplePostSlot, runDueBlast as runDueTriplePosts };
