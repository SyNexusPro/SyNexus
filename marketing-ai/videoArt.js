import { escapeXml, wrapLines } from "./videoUtils.js";
import { renderLogoFooterMark, renderLogoHero, renderLogoWatermark } from "./videoLogo.js";
import { renderSynBunnyInline } from "./synBunny.js";
import { MATTE_BLACK, ACCENT, NEON, SUBSTRATE, HIGHLIGHT, MUTED, CYAN, DANGER } from "./brandPalette.js";

const W = 1080;
const H = 1920;

function showVideoMascot() {
  return process.env.VIDEO_MASCOT?.trim() === "1" || process.env.SHOW_SYN_BUNNY === "1";
}

/** Brand palette — matte black + electric purple neon (SyNexus v1.0). */
const PCB_GREEN = ACCENT;
const NEON_GREEN = NEON;
const PCB_SUBSTRATE = SUBSTRATE;

/** Procedural PCB traces — bright green on dark substrate. */
function circuitBoard() {
  const traces = [
    "M 0 280 H 420 V 380 H 720 V 520 H 1080",
    "M 0 620 H 260 V 740 H 540 V 860 H 1080",
    "M 1080 980 H 780 V 1100 H 480 V 1220 H 0",
    "M 1080 1380 H 640 V 1500 H 320 V 1620 H 0",
    "M 0 1780 H 360 V 1680 H 680 V 1580 H 1080",
    "M 180 0 V 220 H 360 V 440",
    "M 900 0 V 180 H 720 V 360",
    "M 540 1320 V 1080 H 820 V 920",
  ];

  const chips = [
    { x: 380, y: 350, w: 88, h: 56 },
    { x: 680, y: 720, w: 104, h: 64 },
    { x: 240, y: 1080, w: 96, h: 58 },
    { x: 760, y: 1460, w: 112, h: 68 },
    { x: 120, y: 1640, w: 80, h: 48 },
  ];

  const nodes = [
    [420, 280],
    [420, 380],
    [720, 380],
    [720, 520],
    [260, 620],
    [540, 740],
    [780, 980],
    [640, 1380],
    [360, 1780],
    [540, 1320],
    [820, 1080],
  ];

  let out = `<g id="pcb" opacity="0.98">`;

  for (const d of traces) {
    out += `<path d="${d}" fill="none" stroke="${PCB_GREEN}" stroke-width="5" stroke-opacity="0.06"/>`;
    out += `<path d="${d}" fill="none" stroke="${NEON_GREEN}" stroke-width="2.5" stroke-opacity="0.38" filter="url(#circuitBloom)"/>`;
    out += `<path d="${d}" fill="none" stroke="${NEON_GREEN}" stroke-width="1" stroke-opacity="0.85" filter="url(#traceGlow)"/>`;
  }

  for (const { x, y, w, h } of chips) {
    out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${PCB_SUBSTRATE}" stroke="${PCB_GREEN}" stroke-opacity="0.5" stroke-width="1.5" filter="url(#traceGlow)"/>`;
    out += `<rect x="${x + 6}" y="${y + 6}" width="${w - 12}" height="${h - 12}" rx="2" fill="${PCB_GREEN}" fill-opacity="0.08"/>`;
    for (let i = 0; i < 4; i += 1) {
      out += `<rect x="${x - 5}" y="${y + 10 + i * 12}" width="5" height="4" fill="#00ff88" fill-opacity="0.4"/>`;
      out += `<rect x="${x + w}" y="${y + 10 + i * 12}" width="5" height="4" fill="#00ff88" fill-opacity="0.4"/>`;
    }
  }

  for (const [cx, cy] of nodes) {
    out += `<circle cx="${cx}" cy="${cy}" r="18" fill="${PCB_GREEN}" fill-opacity="0.08" filter="url(#circuitBloom)"/>`;
    out += `<circle cx="${cx}" cy="${cy}" r="10" fill="${PCB_GREEN}" fill-opacity="0.18"/>`;
    out += `<circle cx="${cx}" cy="${cy}" r="5" fill="${NEON_GREEN}" fill-opacity="0.95" filter="url(#traceGlow)"/>`;
  }

  out += "</g>";
  return out;
}

function hexGrid() {
  const lines = [];
  for (let x = 0; x <= W; x += 72) {
    lines.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#00ff88" stroke-opacity="0.03" stroke-width="1"/>`,
    );
  }
  for (let y = 0; y <= H; y += 72) {
    lines.push(
      `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#00ff88" stroke-opacity="0.03" stroke-width="1"/>`,
    );
  }
  return lines.join("\n");
}

function circuitEnergyPulses() {
  const pulses = [
    [420, 280],
    [720, 520],
    [540, 740],
    [780, 980],
    [640, 1380],
  ];
  return pulses
    .map(
      ([cx, cy], i) =>
        `<circle cx="${cx}" cy="${cy}" r="${28 + (i % 3) * 8}" fill="none" stroke="${NEON_GREEN}" stroke-width="1.5" stroke-opacity="${0.22 + (i % 2) * 0.08}" filter="url(#circuitBloom)"/>`,
    )
    .join("\n");
}

function matteVignette() {
  return `
  <rect width="100%" height="100%" fill="url(#vignette)" opacity="0.92"/>`;
}

function scanLines() {
  let out = "";
  for (let y = 0; y < H; y += 5) {
    out += `<rect x="0" y="${y}" width="${W}" height="1" fill="${PCB_GREEN}" opacity="0.012"/>`;
  }
  return out;
}

function baseDefs() {
  return `
  <defs>
    <radialGradient id="orbTop" cx="50%" cy="18%" r="55%">
      <stop offset="0%" stop-color="${NEON_GREEN}" stop-opacity="0.35"/>
      <stop offset="40%" stop-color="${PCB_GREEN}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="${MATTE_BLACK}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orbMid" cx="50%" cy="50%" r="45%">
      <stop offset="0%" stop-color="${PCB_GREEN}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="${MATTE_BLACK}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orbBottom" cx="50%" cy="92%" r="42%">
      <stop offset="0%" stop-color="${PCB_GREEN}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${MATTE_BLACK}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vignette" cx="50%" cy="50%" r="72%">
      <stop offset="55%" stop-color="${MATTE_BLACK}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${MATTE_BLACK}" stop-opacity="0.78"/>
    </radialGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#050505"/>
      <stop offset="50%" stop-color="${MATTE_BLACK}"/>
      <stop offset="100%" stop-color="${MATTE_BLACK}"/>
    </linearGradient>
    <linearGradient id="neon" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${PCB_GREEN}" stop-opacity="0"/>
      <stop offset="50%" stop-color="${NEON_GREEN}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${PCB_GREEN}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="titleGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${NEON_GREEN}"/>
      <stop offset="50%" stop-color="${HIGHLIGHT}"/>
      <stop offset="100%" stop-color="${NEON_GREEN}"/>
    </linearGradient>
    <filter id="circuitBloom" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="10" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="traceGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="14" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="megaGlow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="22" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>`;
}

function baseBackground() {
  return `
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#orbTop)"/>
  <rect width="100%" height="100%" fill="url(#orbMid)"/>
  <rect width="100%" height="100%" fill="url(#orbBottom)"/>
  ${circuitBoard()}
  ${circuitEnergyPulses()}
  ${hexGrid()}
  ${scanLines()}
  ${matteVignette()}
  <rect x="36" y="36" width="1008" height="1848" rx="28" fill="none" stroke="${PCB_GREEN}" stroke-opacity="0.45" stroke-width="2.5" filter="url(#circuitBloom)"/>
  <rect x="48" y="48" width="984" height="1824" rx="24" fill="none" stroke="${NEON_GREEN}" stroke-opacity="0.18" stroke-width="1"/>
  <rect x="0" y="580" width="${W}" height="5" fill="url(#neon)" opacity="0.98" filter="url(#circuitBloom)"/>
  <rect x="0" y="1340" width="${W}" height="4" fill="url(#neon)" opacity="0.75" filter="url(#circuitBloom)"/>`;
}

function footerBar(sub = "synexus.pro · non-custodial intelligence") {
  return `
  <text x="540" y="1780" font-size="36" fill="${NEON}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" letter-spacing="0.14em" filter="url(#glow)">
    PASTE · SCAN · DECIDE
  </text>
  <text x="540" y="1840" font-size="26" fill="${MUTED}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" letter-spacing="0.1em">
    ${escapeXml(sub)}
  </text>`;
}

function renderFlowSteps(steps) {
  const startY = 680;
  const gap = 200;
  return steps
    .map((step, i) => {
      const y = startY + i * gap;
      return `
      <rect x="120" y="${y}" width="840" height="150" rx="20" fill="#041008" fill-opacity="0.85" stroke="#00ff88" stroke-opacity="0.55" stroke-width="2" filter="url(#traceGlow)"/>
      <text x="160" y="${y + 58}" font-size="28" fill="#5ee7ff" font-family="Segoe UI, Arial, sans-serif" font-weight="700" letter-spacing="0.2em">${String(i + 1).padStart(2, "0")}</text>
      <text x="220" y="${y + 62}" font-size="44" fill="${HIGHLIGHT}" font-family="Segoe UI, Arial, sans-serif" font-weight="800" filter="url(#glow)">${escapeXml(step.label)}</text>
      <text x="220" y="${y + 108}" font-size="28" fill="${MUTED}" font-family="Segoe UI, Arial, sans-serif">${escapeXml(step.sub)}</text>`;
    })
    .join("\n");
}

function bigHeadline(text, y, size = 72) {
  const lines = wrapLines(text, 16);
  return lines
    .map(
      (line, i) =>
        `<text x="540" y="${y + i * (size + 16)}" font-size="${size}" fill="url(#titleGrad)" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" filter="url(#megaGlow)" letter-spacing="0.06em">${escapeXml(line)}</text>`,
    )
    .join("\n");
}

function subLine(text, y) {
  return `<text x="540" y="${y}" font-size="34" fill="#ffffff" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="600" letter-spacing="0.12em">${escapeXml(text)}</text>`;
}

function fakeDashboard() {
  return `
  <g opacity="0.92">
    <rect x="80" y="900" width="920" height="520" rx="20" fill="#020806" stroke="#00ff88" stroke-opacity="0.45" stroke-width="2" filter="url(#traceGlow)"/>
    <text x="120" y="960" font-size="22" fill="${CYAN}" font-family="Segoe UI, Arial, sans-serif" font-weight="700" letter-spacing="0.2em">SYNEXUS AI</text>
    <text x="120" y="1000" font-size="18" fill="${NEON}" font-family="monospace">TOKEN ████████...pump</text>
    <rect x="120" y="1020" width="400" height="12" rx="4" fill="#041008" stroke="#00ff88" stroke-opacity="0.3"/>
    <rect x="120" y="1020" width="280" height="12" rx="4" fill="#89ff2f" fill-opacity="0.7"/>
    <text x="540" y="1032" font-size="16" fill="${NEON}" font-family="monospace">RISK 67/100</text>
    <text x="120" y="1080" font-size="16" fill="${MUTED}" font-family="monospace">LIQ $128K · WHALES 41%</text>
    <text x="120" y="1120" font-size="28" fill="${DANGER}" font-family="Segoe UI, Arial, sans-serif" font-weight="800">VERDICT: WATCH</text>
    <text x="120" y="1180" font-size="14" fill="${CYAN}" font-family="monospace">Aegis · Pulse · Titan · Cipher</text>
    ${Array.from({ length: 8 }, (_, i) => `<rect x="${120 + (i % 4) * 210}" y="${1220 + Math.floor(i / 4) * 80}" width="190" height="60" rx="8" fill="#041008" stroke="#00ff88" stroke-opacity="0.25"/>`).join("")}
  </g>`;
}

function glitchOverlay(intensity = 1) {
  if (intensity <= 0) return "";
  return `
  <g opacity="${0.15 + intensity * 0.1}">
    ${Array.from({ length: 6 }, (_, i) => {
      const y = 400 + i * 220;
      return `<rect x="0" y="${y}" width="${W}" height="${8 + (i % 3) * 4}" fill="${NEON}" opacity="0.35"/>`;
    }).join("")}
    <text x="542" y="480" font-size="80" fill="#ff0040" opacity="0.25" font-family="Segoe UI, Arial, sans-serif" font-weight="900">▌</text>
    <text x="538" y="480" font-size="80" fill="#00ffff" opacity="0.2" font-family="Segoe UI, Arial, sans-serif" font-weight="900">▌</text>
  </g>`;
}

export function renderSceneSvg(scene) {
  const kicker = escapeXml(scene.kicker || "");
  const headline = scene.headline || "";
  const sub = scene.sub || "";

  let body = "";

  if (scene.id === "intro") {
    body = `
    <text x="540" y="200" font-size="30" fill="${CYAN}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700" letter-spacing="0.28em" filter="url(#traceGlow)">SYNEXUS</text>
    ${bigHeadline(headline, 480, 88)}
    ${subLine(sub, 720)}
    ${renderLogoHero({ size: 220, centerY: 1080 })}`;
  } else if (scene.id === "hook" || scene.phase) {
    const showDash = scene.visualStyle === "dashboard" || scene.visualStyle === "authority" || scene.visualStyle === "chart";
    const showGlitch = scene.visualStyle === "glitch" || scene.visualStyle === "fear" || scene.visualStyle === "urgent";
    const headlineSize = showDash ? 72 : 88;
    body = `
    ${bigHeadline(headline, showDash ? 440 : 540, headlineSize)}
    ${subLine(sub, showDash ? 560 : 760)}
    ${showDash ? fakeDashboard() : ""}
    ${!showDash ? `<rect x="120" y="900" width="840" height="120" rx="18" fill="${SUBSTRATE}" stroke="${NEON}" stroke-opacity="0.75" stroke-width="3" filter="url(#megaGlow)"/>
    <text x="540" y="975" font-size="44" fill="${NEON}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="900" letter-spacing="0.22em" filter="url(#megaGlow)">AVOID · WATCH · OK</text>` : ""}
    ${showGlitch ? glitchOverlay(1.4) : ""}`;
  } else if (scene.id === "flow" && scene.steps) {
    body = `
    ${bigHeadline(headline, 520, 56)}
    ${renderFlowSteps(scene.steps)}`;
  } else if (scene.id === "cta") {
    body = `
    ${renderLogoHero({ size: 140, centerY: 560 })}
    ${bigHeadline(headline, 720, 96)}
    ${subLine(sub, 880)}
    <rect x="160" y="980" width="760" height="120" rx="22" fill="${SUBSTRATE}" stroke="${NEON}" stroke-opacity="0.7" stroke-width="2.5" filter="url(#megaGlow)"/>
    <text x="540" y="1055" font-size="36" fill="${NEON}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" letter-spacing="0.14em">FREE SCAN · SYNEXUS.PRO</text>`;
  } else {
    body = `
    ${bigHeadline(headline, 680, 64)}
    ${subLine(sub, 680 + wrapLines(headline, 16).length * 80 + 40)}`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  ${baseDefs()}
  ${baseBackground()}
  <text x="540" y="130" font-size="26" fill="${ACCENT}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700" letter-spacing="0.26em" opacity="0.9">${kicker.toUpperCase()}</text>
  ${body}
  ${showVideoMascot() ? renderSynBunnyInline({ sceneId: scene.id }) : ""}
  ${renderLogoWatermark(W, H)}
  ${renderLogoFooterMark()}
  ${footerBar(scene.id === "cta" ? sub : "synexus.pro · you control your funds")}
</svg>`;
}
