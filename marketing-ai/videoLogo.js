import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Synexus Pro mark — used as watermark on every rendered scene. */
const LOGO_CANDIDATES = [
  join(__dirname, "..", "public", "synexus-symbol.png"),
  join(__dirname, "..", "public", "synexus-logo.png"),
];

let cachedDataUri = null;

function resolveLogoPath() {
  for (const path of LOGO_CANDIDATES) {
    try {
      readFileSync(path);
      return path;
    } catch {
      /* try next */
    }
  }
  throw new Error(
    `Synexus logo not found. Expected one of:\n${LOGO_CANDIDATES.join("\n")}`,
  );
}

/** PNG as data URI for embedding in SVG (resvg-safe). */
export function getSynexusLogoDataUri() {
  if (cachedDataUri) return cachedDataUri;
  const path = resolveLogoPath();
  const buf = readFileSync(path);
  cachedDataUri = `data:image/png;base64,${buf.toString("base64")}`;
  return cachedDataUri;
}

/**
 * Corner watermark — present on every scene.
 * @param {number} frameW
 * @param {number} frameH
 */
export function renderLogoWatermark(frameW = 1080, frameH = 1920) {
  const uri = getSynexusLogoDataUri();
  const size = 88;
  const padX = 52;
  const padY = 168;
  const x = frameW - padX - size;
  const y = padY;
  const cx = x + size / 2;
  const cy = y + size / 2;

  return `
  <g id="synexus-logo-watermark" opacity="0.96">
    <circle cx="${cx}" cy="${cy}" r="${size / 2 + 10}" fill="#020806" fill-opacity="0.78"/>
    <circle cx="${cx}" cy="${cy}" r="${size / 2 + 8}" fill="none" stroke="#89ff2f" stroke-opacity="0.65" stroke-width="2"/>
    <image href="${uri}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>
    <text x="${cx}" y="${y + size + 28}" font-size="18" fill="#89ff2f" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700" letter-spacing="0.14em">SYNEXUS PRO</text>
  </g>`;
}

/** Larger centered logo for intro / CTA scenes. */
export function renderLogoHero({ size = 220, centerY = 980 } = {}) {
  const uri = getSynexusLogoDataUri();
  const x = (1080 - size) / 2;
  const y = centerY - size / 2;
  const cx = 540;
  const cy = centerY;

  return `
  <g id="synexus-logo-hero">
    <circle cx="${cx}" cy="${cy}" r="${size / 2 + 28}" fill="none" stroke="#89ff2f" stroke-opacity="0.35" stroke-width="2.5"/>
    <circle cx="${cx}" cy="${cy}" r="${size / 2 + 14}" fill="none" stroke="#00ff88" stroke-opacity="0.25" stroke-width="1.5"/>
    <image href="${uri}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>
  </g>`;
}

/** Small footer-left mark above the tagline bar. */
export function renderLogoFooterMark() {
  const uri = getSynexusLogoDataUri();
  const size = 52;
  const x = 72;
  const y = 1710;
  return `<image href="${uri}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" opacity="0.88"/>`;
}
