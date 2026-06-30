#!/usr/bin/env node
/**
 * Build YouTube channel art (2560×1440) with logo in the safe zone (1546×423).
 *
 *   npm run youtube:banner
 *   node youtubeChannelBanner.js path/to/logo.png
 */

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const YT_W = 2560;
const YT_H = 1440;
const SAFE_W = 1546;
const SAFE_H = 423;

const DEFAULT_SRC = join(__dirname, "assets", "synexus-banner-source.png");
const OUT_DIR = join(__dirname, "output");
const OUT_FILE = join(OUT_DIR, "youtube-channel-banner-2560x1440.png");

async function buildBanner(sourcePath = DEFAULT_SRC) {
  await mkdir(OUT_DIR, { recursive: true });

  const logoBuf = await sharp(sourcePath)
    .resize(SAFE_W, SAFE_H, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();

  const logoMeta = await sharp(logoBuf).metadata();

  // Matte black + subtle electric-purple vignette (SyNexus v1.0)
  const bgSvg = `<svg width="${YT_W}" height="${YT_H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="g" cx="50%" cy="45%" r="70%">
        <stop offset="0%" stop-color="#120818"/>
        <stop offset="55%" stop-color="#060608"/>
        <stop offset="100%" stop-color="#000000"/>
      </radialGradient>
      <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#7c3aed" stop-opacity="0"/>
        <stop offset="50%" stop-color="#a855f7" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#7c3aed" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect x="0" y="${Math.round(YT_H / 2 - 1)}" width="${YT_W}" height="2" fill="url(#line)" opacity="0.6"/>
  </svg>`;

  const left = Math.round((YT_W - logoMeta.width) / 2);
  const top = Math.round((YT_H - logoMeta.height) / 2);

  await sharp(Buffer.from(bgSvg))
    .composite([{ input: logoBuf, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(OUT_FILE);

  return {
    out: OUT_FILE,
    canvas: `${YT_W}x${YT_H}`,
    logo: `${logoMeta.width}x${logoMeta.height}`,
    safeZone: `${SAFE_W}x${SAFE_H}`,
  };
}

const src = process.argv[2] || DEFAULT_SRC;
buildBanner(src)
  .then((info) => {
    console.log("\n✓ YouTube channel banner ready\n");
    console.log(`  File:   ${info.out}`);
    console.log(`  Canvas: ${info.canvas}`);
    console.log(`  Logo:   ${info.logo} (centered in ${info.safeZone} safe area)`);
    console.log("\nUpload: YouTube Studio → Customization → Branding → Banner image\n");
  })
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
