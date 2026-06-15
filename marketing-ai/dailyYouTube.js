#!/usr/bin/env node
/**
 * Synexus daily YouTube pipeline — render + upload, hands-off.
 *
 *   node dailyYouTube.js              # today: render if needed, then upload
 *   node dailyYouTube.js --watch      # run now + every local midnight
 *   node dailyYouTube.js --force      # re-render and re-upload today
 */

import { loadMarketingEnv } from "./loadEnv.js";
import { renderDailyVideo } from "./makeVideo.js";
import { hasYouTubeCredentials, uploadVideoToYouTube } from "./youtubeUpload.js";
import { msUntilNextLocalMidnight, parseArgs } from "./videoUtils.js";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { buildVideoJob } from "./videoBlueprint.js";

loadMarketingEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));

function outputRoot() {
  return process.env.VIDEO_OUTPUT_DIR?.trim() || join(__dirname, "output");
}

async function publishDaily({ force = false, quiet = false } = {}) {
  if (!hasYouTubeCredentials()) {
    throw new Error(
      "YouTube not connected. Add YOUTUBE_* vars to marketing-ai/.env or run: node youtubeAuth.js",
    );
  }

  const renderResult = await renderDailyVideo({ force, quiet });

  const job = buildVideoJob();
  const dayDir = renderResult.dayDir || join(outputRoot(), job.date);
  const videoPath = renderResult.videoPath || join(dayDir, "synexus-daily.mp4");
  const metadataPath = renderResult.metadataPath || join(dayDir, "youtube-upload.txt");

  const uploadResult = await uploadVideoToYouTube({
    videoPath,
    metadataPath,
    dayDir,
    force,
    quiet,
  });

  return { renderResult, uploadResult, dayDir };
}

function printHelp() {
  console.log(`Synexus Daily YouTube — automated render + publish

Usage:
  node dailyYouTube.js              Publish today's Short
  node dailyYouTube.js --watch      Auto-publish at startup + every midnight
  node dailyYouTube.js --force      Re-render and re-upload today
  node dailyYouTube.js --quiet      Less log noise

Requires marketing-ai/.env:
  YOUTUBE_CLIENT_ID
  YOUTUBE_CLIENT_SECRET
  YOUTUBE_REFRESH_TOKEN

Optional:
  YOUTUBE_PRIVACY=public            public | unlisted | private
  YOUTUBE_CATEGORY_ID=28
  VIDEO_OUTPUT_DIR
  APP_ORIGIN

Windows Task Scheduler (daily 6 AM):
  Program: npm
  Args: run youtube:daily --prefix "C:\\...\\marketing-ai"
`);
}

async function runWatch() {
  const tick = async (label) => {
    try {
      console.log(`\n[${new Date().toLocaleString()}] ${label}`);
      await publishDaily({ quiet: false });
    } catch (err) {
      console.error("[Synexus YouTube]", err.message || err);
    }
  };

  await tick("Daily publish");
  const schedule = () => {
    const wait = msUntilNextLocalMidnight();
    console.log(`Next publish in ${Math.round(wait / 3600000)}h (local midnight).`);
    setTimeout(async () => {
      await tick("Midnight publish");
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

  await publishDaily({ force, quiet });
}

const isMain =
  process.argv[1] &&
  (fileURLToPath(import.meta.url) === process.argv[1].replace(/\\/g, "/") ||
    process.argv[1].endsWith("dailyYouTube.js"));

if (isMain) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}

export { publishDaily };
