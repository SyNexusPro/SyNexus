#!/usr/bin/env node
/**
 * Synexus Daily Video — hands-off Shorts/Reels generator.
 *
 *   node makeVideo.js              # today's video (skip if already exists)
 *   node makeVideo.js --upload     # render + upload to YouTube (if connected)
 *   node makeVideo.js --force      # re-render today
 *
 * Prefer: npm run youtube:daily — full render + publish automation.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMarketingEnv } from "./loadEnv.js";
import { buildVideoJob, todayDirName } from "./videoBlueprint.js";
import { renderSceneSvg } from "./videoArt.js";
import { renderSynBunnyStandaloneSvg, clearSynBunnyCache } from "./synBunny.js";
import {
  composeVideo,
  fileExists,
  logSummary,
  renderSvgToPng,
  synthesizeVoiceover,
  writeYouTubeMetadata,
} from "./videoPipeline.js";
import { hasYouTubeCredentials, uploadVideoToYouTube } from "./youtubeUpload.js";
import { msUntilNextLocalMidnight, parseArgs } from "./videoUtils.js";

loadMarketingEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const VOICE = process.env.VIDEO_TTS_VOICE?.trim() || "en-US-GuyNeural";

function outputRoot() {
  return process.env.VIDEO_OUTPUT_DIR?.trim() || join(__dirname, "output");
}

async function renderDailyVideo({ force = false, quiet = false, upload = false } = {}) {
  const now = Date.now();
  const job = buildVideoJob(now);
  const dayDir = join(outputRoot(), job.date);
  const videoPath = join(dayDir, "synexus-daily.mp4");
  const metaPath = join(dayDir, "youtube-upload.txt");

  let skipped = false;
  let metadataPath = metaPath;
  let audioSec = 0;
  let totalSec = 0;

  if (!force && (await fileExists(videoPath)) && (await fileExists(metaPath))) {
    skipped = true;
    if (!quiet) {
      console.log(`Today's video already exists (${job.date}). Use --force to re-render.`);
      console.log(videoPath);
    }
  } else {
    if (!quiet) {
      console.log(`\nSynexus Daily Video · ${job.date}`);
      console.log("─".repeat(48));
      console.log("1/4 Building blueprint…");
    }

    const scenesDir = join(dayDir, "scenes");
    await mkdir(scenesDir, { recursive: true });

    const bunnySvg = renderSynBunnyStandaloneSvg(512);
    const bunnyPng = join(dayDir, "syn-bunny.png");
    await writeFile(join(dayDir, "syn-bunny.svg"), bunnySvg, "utf8");
    await renderSvgToPng(bunnySvg, bunnyPng);
    clearSynBunnyCache();

    const scenePngPaths = [];
    for (let i = 0; i < job.scenes.length; i += 1) {
      const scene = job.scenes[i];
      const svg = renderSceneSvg(scene);
      const pngPath = join(scenesDir, `${String(i + 1).padStart(2, "0")}-${scene.id}.png`);
      await renderSvgToPng(svg, pngPath);
      scenePngPaths.push(pngPath);
      await writeFile(join(scenesDir, `${scene.id}.svg`), svg, "utf8");
    }

    if (!quiet) console.log("2/4 Synthesizing voiceover…");
    const audioPath = await synthesizeVoiceover(job.voiceover, dayDir, VOICE);
    await writeFile(join(dayDir, "voiceover.txt"), `${job.voiceover}\n`, "utf8");

    if (!quiet) console.log("3/4 Composing HD video (slow preset, CRF 17)…");
    const composed = await composeVideo({
      scenes: job.scenes,
      scenePngPaths,
      audioPath,
      videoPath,
      quiet,
    });
    audioSec = composed.audioSec;
    totalSec = composed.totalSec;

    if (!quiet) console.log("4/4 Writing YouTube metadata…");
    metadataPath = await writeYouTubeMetadata(dayDir, job.metadata, job.voiceover);
    logSummary({ videoPath, metadataPath, audioSec, totalSec, quiet });
  }

  let uploadResult = null;
  if (upload && hasYouTubeCredentials()) {
    uploadResult = await uploadVideoToYouTube({
      videoPath,
      metadataPath,
      dayDir,
      force,
      quiet,
    });
  } else if (upload && !hasYouTubeCredentials()) {
    console.warn("Skipping upload — YouTube credentials not set in marketing-ai/.env");
  }

  return { skipped, videoPath, metadataPath, dayDir, audioSec, totalSec, uploadResult };
}

function printHelp() {
  console.log(`Synexus Daily Video

  node makeVideo.js              Render today
  node makeVideo.js --upload     Render + YouTube upload
  npm run youtube:daily          Recommended daily pipeline
  npm run youtube:watch          Auto-publish every midnight
`);
}

async function runWatch(upload) {
  const render = async (label) => {
    try {
      console.log(`\n[${new Date().toLocaleString()}] ${label}`);
      await renderDailyVideo({ quiet: false, upload });
    } catch (err) {
      console.error("[Synexus video]", err.message || err);
    }
  };

  await render("Initial daily render");
  const schedule = () => {
    const wait = msUntilNextLocalMidnight();
    console.log(`Next auto-render in ${Math.round(wait / 3600000)}h (local midnight).`);
    setTimeout(async () => {
      await render("Midnight daily render");
      schedule();
    }, wait);
  };
  schedule();
}

async function main() {
  const { force, watch, upload, noUpload, quiet, help } = parseArgs(process.argv.slice(2));
  if (help) {
    printHelp();
    return;
  }

  const doUpload = upload && !noUpload;
  if (watch) {
    await runWatch(doUpload);
    return;
  }

  await renderDailyVideo({ force, quiet, upload: doUpload });
}

const isMain =
  process.argv[1] &&
  (fileURLToPath(import.meta.url) === process.argv[1].replace(/\\/g, "/") ||
    process.argv[1].endsWith("makeVideo.js"));

if (isMain) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  });
}

export { renderDailyVideo, todayDirName };
