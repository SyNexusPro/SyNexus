#!/usr/bin/env node
/**
 * TikTok multi-post scheduler — 2–3 posts per day at configured hours.
 *
 *   npm run tiktok:watch          # run forever, post at each slot
 *   npm run tiktok:post           # post next due slot now
 *   node tiktokScheduler.js --slot 2 --force
 *
 * Env:
 *   TIKTOK_POSTS_PER_DAY=3        (1–3)
 *   TIKTOK_POST_HOURS=9,14,20     (local hours, 24h)
 */

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMarketingEnv } from "./loadEnv.js";
import { renderDailyVideo } from "./makeVideo.js";
import { todayDirName } from "./videoBlueprint.js";
import { generateTikTokCaptions } from "./synexusMarketingBot.js";
import { readCampaignState, writeCampaignState } from "./campaignState.js";
import { hasTikTokApiConfig, publishTikTok, tiktokPostsPerDay } from "./platforms/tiktok.js";
import { fileExists } from "./videoPipeline.js";
import { parseArgs } from "./videoUtils.js";

loadMarketingEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));

function outputRoot() {
  return process.env.VIDEO_OUTPUT_DIR?.trim() || join(__dirname, "output");
}

function postHours() {
  const raw = process.env.TIKTOK_POST_HOURS?.trim() || "9,14,20";
  const hours = raw
    .split(",")
    .map((h) => Number(h.trim()))
    .filter((h) => Number.isFinite(h) && h >= 0 && h <= 23);

  const count = tiktokPostsPerDay();
  if (hours.length >= count) return hours.slice(0, count);

  const defaults = [9, 14, 20];
  return defaults.slice(0, count);
}

function slotKey(slot) {
  return slot === 0 ? "tiktok" : `tiktok-${slot}`;
}

function wasSlotPosted(state, slot) {
  const key = slotKey(slot);
  const info = state?.platforms?.[key];
  return Boolean(info?.postedAt || info?.publishId || (info?.mode === "api" && info?.status === "PUBLISH_COMPLETE"));
}

function msUntilNextSlot(now = new Date()) {
  const hours = postHours();
  const candidates = [];

  for (let dayOffset = 0; dayOffset <= 1; dayOffset += 1) {
    for (const hour of hours) {
      const t = new Date(now);
      t.setDate(t.getDate() + dayOffset);
      t.setHours(hour, 0, 0, 0);
      if (t.getTime() > now.getTime()) candidates.push(t.getTime() - now.getTime());
    }
  }

  return candidates.length ? Math.min(...candidates) : 86_400_000;
}

function currentSlotIndex(now = new Date()) {
  const hours = postHours();
  const h = now.getHours();
  const m = now.getMinutes();

  for (let i = hours.length - 1; i >= 0; i -= 1) {
    if (h > hours[i] || (h === hours[i] && m >= 0)) return i;
  }
  return -1;
}

export async function postTikTokSlot({ slot, force = false, quiet = false } = {}) {
  const date = todayDirName();
  const dayDir = join(outputRoot(), date);
  const videoPath = join(dayDir, "synexus-daily.mp4");

  let state = await readCampaignState(dayDir);
  if (!state.platforms) state.platforms = {};

  if (wasSlotPosted(state, slot) && !force) {
    if (!quiet) console.log(`  ↷ TikTok slot ${slot + 1}: already posted today`);
    return state.platforms[slotKey(slot)];
  }

  if (!quiet) console.log(`\nTikTok slot ${slot + 1}/${tiktokPostsPerDay()} · ${date}`);

  if (!(await fileExists(videoPath))) {
    if (!quiet) console.log("  Rendering daily video first…");
    await renderDailyVideo({ force: false, quiet: true });
  }

  const captions = generateTikTokCaptions(Date.now(), tiktokPostsPerDay());
  const caption = captions[slot] || captions[0];

  try {
    const result = await publishTikTok({ dayDir, videoPath, caption, slot, quiet });
    state.platforms[slotKey(slot)] = { ...result, slot, postedAt: new Date().toISOString() };
    await writeCampaignState(dayDir, state);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    state.platforms[slotKey(slot)] = { error: message, slot, at: new Date().toISOString() };
    await writeCampaignState(dayDir, state);
    throw err;
  }
}

export async function runDueTikTokPosts({ force = false, quiet = false } = {}) {
  const count = tiktokPostsPerDay();
  const slot = Math.max(0, currentSlotIndex());
  const results = [];

  if (slot < 0) {
    if (!quiet) console.log("No TikTok slot due yet today — use --slot N or wait for scheduled hour.");
    return results;
  }

  for (let s = 0; s <= slot && s < count; s += 1) {
    try {
      results.push(await postTikTokSlot({ slot: s, force, quiet }));
    } catch (err) {
      console.error(`  ✗ TikTok slot ${s + 1}: ${err.message || err}`);
    }
  }

  return results;
}

async function runWatch() {
  const tick = async (label) => {
    try {
      console.log(`\n[${new Date().toLocaleString()}] ${label}`);
      if (!hasTikTokApiConfig()) {
        console.warn("TikTok API not configured — run npm run tiktok:auth");
        return;
      }
      await runDueTikTokPosts({ quiet: false });
    } catch (err) {
      console.error("[TikTok scheduler]", err.message || err);
    }
  };

  console.log(`TikTok scheduler · ${tiktokPostsPerDay()} posts/day at ${postHours().join(", ")}:00 local`);
  await tick("Startup — post any due slots");

  const schedule = () => {
    const wait = msUntilNextSlot();
    const next = new Date(Date.now() + wait);
    console.log(`Next TikTok slot at ${next.toLocaleString()} (in ${Math.round(wait / 60000)} min).`);
    setTimeout(async () => {
      await tick("Scheduled TikTok post");
      schedule();
    }, wait);
  };
  schedule();
}

function printHelp() {
  console.log(`Synexus TikTok Scheduler

  npm run tiktok:watch       Auto-post at TIKTOK_POST_HOURS (default 9, 14, 20)
  npm run tiktok:post        Post due slots now
  node tiktokScheduler.js --slot 1 --force

Setup:
  1. TikTok Developer Portal → app with Content Posting API + Direct Post
  2. Approve video.publish scope
  3. npm run tiktok:auth
  4. npm run tiktok:watch   (or Windows Task Scheduler at 9am, 2pm, 8pm)

Env:
  TIKTOK_POSTS_PER_DAY=3
  TIKTOK_POST_HOURS=9,14,20
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
    await postTikTokSlot({ slot: Number.isFinite(slot) ? slot : 0, force, quiet });
    return;
  }

  await runDueTikTokPosts({ force, quiet });
}

const isMain =
  process.argv[1] &&
  (fileURLToPath(import.meta.url) === process.argv[1].replace(/\\/g, "/") ||
    process.argv[1].endsWith("tiktokScheduler.js"));

if (isMain) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  });
}
