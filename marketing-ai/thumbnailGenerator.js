#!/usr/bin/env node
/**
 * YouTube thumbnail generator — purple · 3 words max · high contrast.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BRAND } from "./viralContentSystem.js";
import { renderSvgToPng } from "./videoPipeline.js";
import { escapeXml, wrapLines } from "./videoUtils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TW = 1280;
const TH = 720;

export function renderThumbnailSvg(words, { subtitle = "SyNexus AI" } = {}) {
  const text = String(words || "SCAM ALERT")
    .toUpperCase()
    .replace(/[^\w\s!?-]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(" ");

  const lines = wrapLines(text, 12);

  const titleLines = lines
    .map(
      (line, i) =>
        `<text x="640" y="${280 + i * 110}" font-size="96" fill="url(#thumbGrad)" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="900" filter="url(#mega)" letter-spacing="0.08em">${escapeXml(line)}</text>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${TW}" height="${TH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#050505"/>
      <stop offset="50%" stop-color="${BRAND.matteBlack}"/>
      <stop offset="100%" stop-color="#1a0a2e"/>
    </linearGradient>
    <linearGradient id="thumbGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${BRAND.neonPurple}"/>
      <stop offset="50%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="${BRAND.electricPurple}"/>
    </linearGradient>
    <radialGradient id="orb" cx="70%" cy="30%" r="50%">
      <stop offset="0%" stop-color="${BRAND.electricPurple}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${BRAND.matteBlack}" stop-opacity="0"/>
    </radialGradient>
    <filter id="mega" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="8" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#orb)"/>
  <rect x="24" y="24" width="1232" height="672" rx="20" fill="none" stroke="${BRAND.electricPurple}" stroke-width="4" stroke-opacity="0.7"/>
  ${titleLines}
  <text x="640" y="620" font-size="36" fill="${BRAND.muted}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700" letter-spacing="0.2em">${escapeXml(subtitle)}</text>
  <circle cx="180" cy="540" r="80" fill="${BRAND.substrate}" stroke="${BRAND.neonPurple}" stroke-width="3" filter="url(#mega)"/>
  <text x="180" y="555" font-size="28" fill="${BRAND.neonPurple}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800">AI</text>
</svg>`;
}

export async function writeThumbnail(words, outPath, opts = {}) {
  const svg = renderThumbnailSvg(words, opts);
  await mkdir(dirname(outPath), { recursive: true });
  await renderSvgToPng(svg, outPath);
  await writeFile(outPath.replace(/\.png$/i, ".svg"), svg, "utf8");
  return outPath;
}

async function main() {
  const words = process.argv.slice(2).join(" ") || "SCAM ALERT";
  const out = join(__dirname, "output", "thumbnails", `${words.replace(/\s+/g, "-").toLowerCase()}.png`);
  await writeThumbnail(words, out);
  console.log(`✓ Thumbnail → ${out}`);
}

const isMain = process.argv[1]?.endsWith("thumbnailGenerator.js");
if (isMain) main().catch((e) => { console.error(e.message); process.exit(1); });
