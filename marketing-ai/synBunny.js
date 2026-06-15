/**
 * Syn — tiny floating Synexus bunny mascot (SYN badge on chest).
 * Inline SVG for video scenes + standalone PNG for Telegram/social.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const MASCOT_NAME = "Syn";

export const MASCOT_TAGLINE = "Paste before you ape.";

/** Where Syn floats per video scene (moves around the frame). */
const SCENE_SPOTS = {
  intro: { x: 760, y: 1180, scale: 1.05, flip: false },
  hook: { x: 108, y: 400, scale: 0.88, flip: true },
  flow: { x: 848, y: 1520, scale: 0.9, flip: false },
  cta: { x: 800, y: 1120, scale: 1, flip: false },
};

export function mascotSignOff() {
  return `🐰 **${MASCOT_NAME}** says: ${MASCOT_TAGLINE}`;
}

export function mascotTelegramLine() {
  return `🐰 ${MASCOT_NAME} · ${MASCOT_TAGLINE}`;
}

/** Chibi bunny vector art centered at 0,0 — ~200px tall at scale 1. */
function bunnyArt() {
  return `
  <g id="syn-bunny-art">
    <!-- float glow -->
    <ellipse cx="0" cy="98" rx="52" ry="10" fill="#00ff88" opacity="0.18"/>
    <ellipse cx="0" cy="98" rx="36" ry="6" fill="#5ee7ff" opacity="0.22"/>

    <!-- tail puff -->
    <circle cx="48" cy="52" r="16" fill="#f5f0e8" stroke="#d8cfc0" stroke-width="1.2"/>

    <!-- body -->
    <ellipse cx="0" cy="48" rx="44" ry="50" fill="#faf7f2" stroke="#e8dfd0" stroke-width="2"/>
    <!-- belly highlight -->
    <ellipse cx="0" cy="54" rx="28" ry="32" fill="#ffffff" opacity="0.55"/>

    <!-- SYN badge on chest -->
    <rect x="-26" y="32" width="52" height="28" rx="8" fill="#041008" stroke="#00ff88" stroke-width="2"/>
    <text x="0" y="52" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="800" fill="#89ff2f" letter-spacing="0.12em">SYN</text>

    <!-- head -->
    <circle cx="0" cy="-8" r="38" fill="#faf7f2" stroke="#e8dfd0" stroke-width="2"/>

    <!-- ears -->
    <ellipse cx="-22" cy="-58" rx="14" ry="36" fill="#faf7f2" stroke="#e8dfd0" stroke-width="2" transform="rotate(-8)"/>
    <ellipse cx="-22" cy="-58" rx="8" ry="24" fill="#ffb4c4" opacity="0.65" transform="rotate(-8)"/>
    <ellipse cx="22" cy="-58" rx="14" ry="36" fill="#faf7f2" stroke="#e8dfd0" stroke-width="2" transform="rotate(8)"/>
    <ellipse cx="22" cy="-58" rx="8" ry="24" fill="#ffb4c4" opacity="0.65" transform="rotate(8)"/>

    <!-- cheeks -->
    <circle cx="-24" cy="2" r="7" fill="#ffb4c4" opacity="0.45"/>
    <circle cx="24" cy="2" r="7" fill="#ffb4c4" opacity="0.45"/>

    <!-- eyes (big anime bunny) -->
    <ellipse cx="-14" cy="-6" rx="10" ry="12" fill="#1a1a1a"/>
    <ellipse cx="14" cy="-6" rx="10" ry="12" fill="#1a1a1a"/>
    <circle cx="-11" cy="-10" r="3.5" fill="#ffffff"/>
    <circle cx="17" cy="-10" r="3.5" fill="#ffffff"/>
    <circle cx="-8" cy="-4" r="1.5" fill="#ffffff" opacity="0.6"/>
    <circle cx="20" cy="-4" r="1.5" fill="#ffffff" opacity="0.6"/>

    <!-- nose + mouth -->
    <ellipse cx="0" cy="4" rx="4" ry="3" fill="#ffb4c4"/>
    <path d="M0 7 Q-6 14 -10 12" fill="none" stroke="#c9a0a8" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M0 7 Q6 14 10 12" fill="none" stroke="#c9a0a8" stroke-width="1.5" stroke-linecap="round"/>

    <!-- tiny paws -->
    <ellipse cx="-30" cy="68" rx="12" ry="8" fill="#faf7f2" stroke="#e8dfd0" stroke-width="1.5"/>
    <ellipse cx="30" cy="68" rx="12" ry="8" fill="#faf7f2" stroke="#e8dfd0" stroke-width="1.5"/>

    <!-- sparkle floaties -->
    <text x="-58" y="-30" font-size="14" fill="#89ff2f" opacity="0.7">✦</text>
    <text x="52" y="-18" font-size="11" fill="#5ee7ff" opacity="0.65">✦</text>
    <text x="62" y="24" font-size="10" fill="#89ff2f" opacity="0.5">✦</text>
  </g>`;
}

/**
 * Inline group for embedding in 1080×1920 video frames.
 * @param {{ sceneId?: string, x?: number, y?: number, scale?: number, flip?: boolean }} opts
 */
export function renderSynBunnyInline(opts = {}) {
  const spot = SCENE_SPOTS[opts.sceneId] ?? SCENE_SPOTS.intro;
  const x = opts.x ?? spot.x;
  const y = opts.y ?? spot.y;
  const scale = opts.scale ?? spot.scale;
  const flip = opts.flip ?? spot.flip;
  const sx = flip ? -scale : scale;

  return `
  <g id="syn-bunny-float" opacity="0.98">
    <g transform="translate(${x}, ${y}) scale(${sx}, ${scale})">
      ${bunnyArt()}
    </g>
    <text x="${x}" y="${y + 118 * scale}" text-anchor="middle" font-size="20" fill="#dcffbe" font-family="Segoe UI, Arial, sans-serif" font-weight="700" opacity="0.85">${MASCOT_NAME}</text>
  </g>`;
}

/** Full square SVG for PNG export (Telegram photo, stickers). */
export function renderSynBunnyStandaloneSvg(size = 512) {
  const pad = size * 0.08;
  const cx = size / 2;
  const cy = size / 2 + size * 0.06;
  const scale = (size - pad * 2) / 220;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bunnyBg" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#0a1812"/>
      <stop offset="100%" stop-color="#020806"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bunnyBg)"/>
  <circle cx="${cx}" cy="${cy}" r="${size * 0.38}" fill="#00ff88" opacity="0.06"/>
  <g transform="translate(${cx}, ${cy}) scale(${scale})">
    ${bunnyArt()}
  </g>
  <text x="${cx}" y="${size - pad * 0.9}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${size * 0.07}" font-weight="800" fill="#89ff2f" letter-spacing="0.14em">SYNEXUS</text>
</svg>`;
}

export function getSynBunnyPngPath() {
  const candidates = [
    join(__dirname, "assets", "syn-bunny.png"),
    join(__dirname, "..", "public", "syn-bunny.png"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0];
}

export function getSynBunnySvgPath() {
  return join(__dirname, "assets", "syn-bunny.svg");
}

let cachedBunnyDataUri = null;

/** PNG data URI for optional SVG embed (after assets generated). */
export function getSynBunnyDataUri() {
  if (cachedBunnyDataUri) return cachedBunnyDataUri;
  const path = getSynBunnyPngPath();
  if (!existsSync(path)) return null;
  const buf = readFileSync(path);
  cachedBunnyDataUri = `data:image/png;base64,${buf.toString("base64")}`;
  return cachedBunnyDataUri;
}

export function clearSynBunnyCache() {
  cachedBunnyDataUri = null;
}
