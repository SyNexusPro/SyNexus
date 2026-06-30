#!/usr/bin/env node
/** Upload whale-alert Short as a YouTube connection test. */
import { join, dirname } from "node:path";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadMarketingEnv } from "./loadEnv.js";
import { hasYouTubeCredentials, uploadVideoToYouTube } from "./youtubeUpload.js";
import { youtubeTitleFor, buildCaptions, HYPE_ASSETS } from "./hypeAssetCatalog.js";

loadMarketingEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const dayDir = join(__dirname, "output", "hype-assets");
const videoPath = join(dayDir, "whale-alert.mp4");
const asset = HYPE_ASSETS.find((a) => a.id === "whale-alert");
const origin = process.env.APP_ORIGIN?.trim() || "https://synexus.pro";
const metaPath = join(dayDir, "whale-alert-youtube.txt");

if (!hasYouTubeCredentials()) {
  console.error("\nYouTube not connected yet.");
  console.error("Run: npm run youtube:auth:callback");
  console.error("Approve in browser, then run: npm run youtube:test\n");
  process.exit(1);
}

const title = youtubeTitleFor(asset);
const caps = buildCaptions(asset, origin);
await writeFile(
  metaPath,
  `TITLE:\n${title}\n\nDESCRIPTION:\n${caps.tiktok}\n\nTAGS:\nSynexus, AI, crypto, Solana, Shorts, Whale Alert\n`,
  "utf8",
);

console.log("\nUploading WHALE ALERT test Short to YouTube…\n");
const result = await uploadVideoToYouTube({
  videoPath,
  metadataPath: metaPath,
  dayDir,
  force: true,
  quiet: false,
  titleSuffix: "WHALE ALERT",
});

console.log(`\n✓ Live: ${result.url}\n`);
