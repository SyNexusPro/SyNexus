#!/usr/bin/env node
/**
 * Split hype sheet → 10 panels · image → 9:16 video · blast all platforms.
 *
 *   npm run hype:split
 *   npm run hype:blast -- --force
 *   npm run hype:all -- --force
 */

import { mkdir, writeFile, readFile, access, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "node:child_process";
import { loadMarketingEnv } from "./loadEnv.js";
import {
  HYPE_ASSETS,
  CREATIVE_SLOTS,
  cropForAsset,
  buildCaptions,
  youtubeTitleFor,
} from "./hypeAssetCatalog.js";
import { readdir, copyFile } from "node:fs/promises";
import { postTelegram, hasTelegramConfig } from "./platforms/telegram.js";
import { publishX } from "./platforms/xTwitter.js";
import { postDiscord, hasDiscordConfig } from "./platforms/discord.js";
import { publishTikTok, hasTikTokApiConfig } from "./platforms/tiktok.js";
import { publishFacebook, publishInstagram } from "./platforms/meta.js";
import { uploadVideoToYouTube, hasYouTubeCredentials } from "./youtubeUpload.js";
import { fileExists, runFfmpeg } from "./videoPipeline.js";
import { parseArgs } from "./videoUtils.js";

loadMarketingEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(__dirname, "assets", "hype-sheet-source.png");
const CREATIVES = join(__dirname, "assets", "hype-creatives");
const OUT = join(__dirname, "output", "hype-assets");
const STATE_PATH = join(OUT, "blast-state.json");

const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp"];

async function findCreativeFile(prefix) {
  let names = [];
  try {
    names = await readdir(CREATIVES);
  } catch {
    return null;
  }
  const lower = prefix.toLowerCase();
  const hit = names.find((n) => n.toLowerCase().startsWith(lower) && IMAGE_EXT.some((e) => n.toLowerCase().endsWith(e)));
  return hit ? join(CREATIVES, hit) : null;
}

export async function loadUserCreatives({ quiet = false } = {}) {
  await mkdir(CREATIVES, { recursive: true });
  await mkdir(OUT, { recursive: true });
  const loaded = [];

  for (const slot of CREATIVE_SLOTS) {
    const src = await findCreativeFile(slot.prefix);
    if (!src) continue;
    const ext = src.slice(src.lastIndexOf("."));
    const dest = join(OUT, `${slot.id}${ext}`);
    await copyFile(src, dest);
    loaded.push({ ...slot, src, imagePath: dest });
    if (!quiet) console.log(`  ✓ ${slot.prefix} → ${slot.id}`);
  }

  if (loaded.length === 0) {
    throw new Error(
      `No files in ${CREATIVES}\nAdd hand-cut images named 01-whale-alert.jpg etc. See README in that folder.`,
    );
  }
  return loaded;
}

function appOrigin() {
  return process.env.APP_ORIGIN?.trim() || "https://synexus.pro";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function runFfmpegSimple(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(`ffmpeg ${code}: ${stderr.slice(-400)}`));
    });
  });
}

export async function splitHypeSheet({ quiet = false } = {}) {
  await mkdir(OUT, { recursive: true });
  if (!(await fileExists(SOURCE))) {
    throw new Error(`Source sheet missing: ${SOURCE}`);
  }

  const manifest = [];
  for (const asset of HYPE_ASSETS) {
    const { x, y, w, h } = cropForAsset(asset);
    const jpg = join(OUT, `${asset.id}.jpg`);
    await runFfmpegSimple(["-y", "-i", SOURCE, "-vf", `crop=${w}:${h}:${x}:${y}`, jpg]);
    manifest.push({ id: asset.id, jpg, crop: { x, y, w, h } });
    if (!quiet) console.log(`  ✓ ${asset.id}.jpg`);
  }

  await writeFile(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  return manifest;
}

export async function imageToShortVideo(jpgPath, mp4Path, { seconds = 18 } = {}) {
  const vf = [
    "scale=1080:1920:force_original_aspect_ratio=increase",
    "crop=1080:1920",
    `zoompan=z='min(zoom+0.0012,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${seconds * 30}:s=1080x1920:fps=30`,
    "format=yuv420p",
  ].join(",");

  await runFfmpegSimple([
    "-y",
    "-loop", "1",
    "-i", jpgPath,
    "-vf", vf,
    "-t", String(seconds),
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    mp4Path,
  ]);
  return mp4Path;
}

async function readState() {
  try {
    return JSON.parse(await readFile(STATE_PATH, "utf8"));
  } catch {
    return { posted: {} };
  }
}

async function writeState(state) {
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

export async function prepareAllVideos({ quiet = false, useCreatives = true } = {}) {
  await mkdir(OUT, { recursive: true });

  if (useCreatives) {
    const loaded = await loadUserCreatives({ quiet });
    for (const item of loaded) {
      const asset = HYPE_ASSETS.find((a) => a.id === item.id);
      const mp4 = join(OUT, `${item.id}.mp4`);
      let rebuild = !(await fileExists(mp4));
      if (!rebuild) {
        const [srcStat, mp4Stat] = await Promise.all([stat(item.imagePath), stat(mp4)]);
        rebuild = srcStat.mtimeMs > mp4Stat.mtimeMs;
      }
      if (rebuild) {
        if (!quiet) console.log(`  ▶ Video ${item.id}.mp4…`);
        const seconds = asset?.row === "hero" ? 22 : 16;
        await imageToShortVideo(item.imagePath, mp4, { seconds });
      }
    }
    return loaded;
  }

  if (!(await fileExists(join(OUT, "manifest.json")))) {
    await splitHypeSheet({ quiet });
  }

  for (const asset of HYPE_ASSETS) {
    const jpg = join(OUT, `${asset.id}.jpg`);
    const mp4 = join(OUT, `${asset.id}.mp4`);
    if (!(await fileExists(jpg))) await splitHypeSheet({ quiet: true });
    if (!(await fileExists(mp4))) {
      if (!quiet) console.log(`  ▶ Video ${asset.id}.mp4…`);
      await imageToShortVideo(jpg, mp4, { seconds: asset.row === "hero" ? 22 : 16 });
    }
  }
}

export async function blastHypeAsset(asset, index, { force = false, quiet = false } = {}) {
  const state = await readState();
  if (state.posted[asset.id] && !force) {
    if (!quiet) console.log(`  ↷ ${asset.id} already posted`);
    return state.posted[asset.id];
  }

  const dayDir = OUT;
  const imagePath =
    (await findCreativeFile(CREATIVE_SLOTS.find((s) => s.id === asset.id)?.prefix || asset.id)) ||
    join(OUT, `${asset.id}.jpg`);
  const mp4 = join(OUT, `${asset.id}.mp4`);
  const caps = buildCaptions(asset, appOrigin());
  const catalogIndex = HYPE_ASSETS.findIndex((a) => a.id === asset.id);
  const slot = catalogIndex >= 0 ? catalogIndex : index;

  if (!quiet) {
    console.log(`\n── ${asset.headline} (${asset.id}) ──`);
  }

  const result = { id: asset.id, at: new Date().toISOString(), platforms: {} };

  if (hasTelegramConfig()) {
    try {
      const tg = await postTelegram(caps.telegram, { quiet: true, photoPath: imagePath });
      result.platforms.telegram = { ok: true, mode: "photo", messageId: tg.messageId };
      if (!quiet) console.log("  ✓ Telegram (photo)");
    } catch (err) {
      result.platforms.telegram = { error: err.message };
      console.error(`  ✗ Telegram: ${err.message}`);
    }
  }

  if (await fileExists(mp4)) {
    if (hasDiscordConfig()) {
      try {
        await postDiscord(caps.telegram.replace(/\*\*/g, "**"), { videoPath: mp4, quiet: true });
        result.platforms.discord = { ok: true };
        if (!quiet) console.log("  ✓ Discord (video)");
      } catch (err) {
        result.platforms.discord = { error: err.message };
        console.error(`  ✗ Discord: ${err.message}`);
      }
    }

    try {
      const xRes = await publishX({ dayDir, videoPath: mp4, caption: caps.x, slot, quiet: !quiet });
      result.platforms.x = { ok: true, mode: xRes.mode || "posted", mediaId: xRes.mediaId };
    } catch (err) {
      result.platforms.x = { error: err.message };
    }

    if (hasTikTokApiConfig()) {
      try {
        await publishTikTok({ dayDir, videoPath: mp4, caption: caps.tiktok, slot, quiet: true });
        result.platforms.tiktok = { ok: true };
        if (!quiet) console.log("  ✓ TikTok");
      } catch (err) {
        result.platforms.tiktok = { error: err.message };
      }
    }

    try {
      const fb = await publishFacebook({ dayDir, videoPath: mp4, caption: caps.facebook, slot, quiet: true });
      if (fb.mode === "api" && fb.videoId) {
        result.platforms.facebook = { ok: true, videoId: fb.videoId };
        if (!quiet) console.log("  ✓ Facebook");
      } else {
        result.platforms.facebook = { ok: false, mode: "export" };
        if (!quiet) console.log("  ↷ Facebook export only — run npm run meta:auth");
      }
    } catch (err) {
      result.platforms.facebook = { error: err.message };
    }

    try {
      const ig = await publishInstagram({ dayDir, videoPath: mp4, caption: caps.instagram, slot, quiet: true });
      if (ig.mode === "api" && ig.mediaId) {
        result.platforms.instagram = { ok: true, mediaId: ig.mediaId };
        if (!quiet) console.log("  ✓ Instagram");
      } else {
        result.platforms.instagram = { ok: false, mode: "export" };
        if (!quiet) console.log("  ↷ Instagram export only — run npm run meta:auth");
      }
    } catch (err) {
      result.platforms.instagram = { error: err.message };
    }

    if (hasYouTubeCredentials()) {
      try {
        const metaPath = join(OUT, `${asset.id}-youtube.txt`);
        const title = youtubeTitleFor(asset);
        await writeFile(
          metaPath,
          `TITLE:\n${title}\n\nDESCRIPTION:\n${caps.tiktok}\n\nTAGS:\nSynexus, AI, crypto, Solana, Shorts\n`,
          "utf8",
        );
        const yt = await uploadVideoToYouTube({
          videoPath: mp4,
          metadataPath: metaPath,
          dayDir: OUT,
          force,
          quiet: true,
          slot,
          titleSuffix: asset.headline,
        });
        result.platforms.youtube = { ok: true, videoId: yt.videoId };
        if (!quiet) console.log(`  ✓ YouTube${yt.videoId ? ` · ${yt.videoId}` : ""}`);
      } catch (err) {
        result.platforms.youtube = { error: err.message };
        console.error(`  ✗ YouTube: ${err.message}`);
      }
    }
  }

  state.posted[asset.id] = result;
  await writeState(state);
  return result;
}

export async function blastAllHype({ force = false, delayMs = 12000, quiet = false, useCreatives = true, onlyId = null } = {}) {
  const loaded = await prepareAllVideos({ quiet, useCreatives });
  let ids = useCreatives ? loaded.map((l) => l.id) : HYPE_ASSETS.map((a) => a.id);
  if (onlyId) ids = ids.filter((id) => id === onlyId);
  const assets = ids.map((id) => HYPE_ASSETS.find((a) => a.id === id)).filter(Boolean);

  if (assets.length === 0) {
    throw new Error(onlyId ? `No creative for --only=${onlyId}` : "No hype creatives found");
  }

  console.log(`\n🚀 SyNexus Hype Post — ${assets.length} hand-cut assets → all platforms\n`);

  for (let i = 0; i < assets.length; i += 1) {
    await blastHypeAsset(assets[i], i, { force, quiet });
    if (i < assets.length - 1 && delayMs > 0) {
      if (!quiet) console.log(`  … ${Math.round(delayMs / 1000)}s before next`);
      await sleep(delayMs);
    }
  }

  console.log(`\n✓ Hype blast complete → ${OUT}`);
  console.log("  State: blast-state.json");
}

async function main() {
  const args = process.argv.slice(2);
  const { force, help } = parseArgs(args);

  if (help) {
    console.log(`SyNexus hype creatives

  npm run hype:retract         Remove bad auto-cropped posts
  npm run hype:post --force    Post YOUR files from assets/hype-creatives/
  npm run hype:split             (deprecated) auto-crop — don't use
`);
    return;
  }

  if (args.includes("--post")) {
    const onlyArg = args.find((a) => a.startsWith("--only="));
    const onlyId = onlyArg ? onlyArg.split("=")[1] : null;
    await blastAllHype({ force, delayMs: 8000, useCreatives: true, onlyId });
    return;
  }

  if (args.includes("--split")) {
    console.log("\nSplitting hype sheet…");
    await splitHypeSheet({ quiet: false });
    return;
  }

  if (args.includes("--videos")) {
    console.log("\nBuilding Shorts from panels…");
    await prepareAllVideos({ quiet: false });
    return;
  }

  if (args.includes("--all")) {
    console.warn("⚠ hype:all uses auto-crop and is deprecated. Use hype:post with hand-cut files.");
    await splitHypeSheet({ quiet: false });
    await prepareAllVideos({ quiet: false, useCreatives: false });
    await blastAllHype({ force, delayMs: 8000, useCreatives: false });
    return;
  }

  await blastAllHype({ force, delayMs: 8000, useCreatives: true });
}

const isMain =
  process.argv[1] &&
  (import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/")) ||
    process.argv[1].endsWith("hypeBlast.js"));

if (isMain) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
