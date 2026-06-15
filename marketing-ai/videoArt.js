import { escapeXml, wrapLines } from "./videoUtils.js";

const W = 1080;
const H = 1920;

function hexGrid() {
  const lines = [];
  for (let x = 0; x <= W; x += 54) {
    lines.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#00ff88" stroke-opacity="0.04" stroke-width="1"/>`,
    );
  }
  for (let y = 0; y <= H; y += 54) {
    lines.push(
      `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#00ff88" stroke-opacity="0.04" stroke-width="1"/>`,
    );
  }
  return lines.join("\n");
}

function scanLines() {
  let out = "";
  for (let y = 0; y < H; y += 6) {
    out += `<rect x="0" y="${y}" width="${W}" height="1" fill="#ffffff" opacity="0.015"/>`;
  }
  return out;
}

function baseDefs() {
  return `
  <defs>
    <radialGradient id="orb" cx="50%" cy="28%" r="55%">
      <stop offset="0%" stop-color="#00ff88" stop-opacity="0.35"/>
      <stop offset="45%" stop-color="#5ee7ff" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#010302" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#061410"/>
      <stop offset="55%" stop-color="#020806"/>
      <stop offset="100%" stop-color="#000000"/>
    </linearGradient>
    <linearGradient id="neon" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#00ff88" stop-opacity="0"/>
      <stop offset="50%" stop-color="#00ff88" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#5ee7ff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="titleGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#89ff2f"/>
      <stop offset="50%" stop-color="#dcffbe"/>
      <stop offset="100%" stop-color="#5ee7ff"/>
    </linearGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
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
  <rect width="100%" height="100%" fill="url(#orb)"/>
  ${hexGrid()}
  ${scanLines()}
  <rect x="48" y="48" width="984" height="1824" rx="24" fill="none" stroke="#00ff88" stroke-opacity="0.18" stroke-width="2"/>
  <rect x="0" y="640" width="${W}" height="3" fill="url(#neon)" opacity="0.85"/>
  <rect x="0" y="1280" width="${W}" height="2" fill="url(#neon)" opacity="0.45"/>`;
}

function footerBar(sub = "synexus.pro · non-custodial") {
  return `
  <text x="540" y="1780" font-size="34" fill="#00ff88" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700" letter-spacing="0.12em">
    SCAN · WHALE · RISK · ALERT · AI
  </text>
  <text x="540" y="1840" font-size="28" fill="#a8c9a0" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" letter-spacing="0.08em">
    ${escapeXml(sub)}
  </text>`;
}

function renderFeatures(features) {
  const startY = 720;
  return features
    .map((f, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = col === 0 ? 90 : 560;
      const y = startY + row * 200;
      return `
      <rect x="${x}" y="${y}" width="430" height="160" rx="16" fill="#041008" stroke="#00ff88" stroke-opacity="0.35" stroke-width="1.5"/>
      <text x="${x + 24}" y="${y + 52}" font-size="36" fill="#dcffbe" font-family="Segoe UI, Arial, sans-serif" font-weight="700">${escapeXml(f.label)}</text>
      <text x="${x + 24}" y="${y + 98}" font-size="26" fill="#8fb886" font-family="Segoe UI, Arial, sans-serif">${escapeXml(f.sub)}</text>`;
    })
    .join("\n");
}

export function renderSceneSvg(scene) {
  const kicker = escapeXml(scene.kicker || "");
  const headline = escapeXml(scene.headline || "");
  const sub = escapeXml(scene.sub || "");
  const headlineLines = wrapLines(scene.headline || "", 22);

  let body = "";

  if (scene.id === "intro") {
    body = `
    <text x="540" y="420" font-size="110" fill="url(#titleGrad)" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" filter="url(#glow)">SYNEXUS</text>
    <text x="540" y="520" font-size="42" fill="#ffffff" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="600" letter-spacing="0.18em">${headline}</text>
    <text x="540" y="590" font-size="32" fill="#5ee7ff" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif">${sub}</text>
    <circle cx="540" cy="980" r="120" fill="none" stroke="#00ff88" stroke-opacity="0.25" stroke-width="2"/>
    <circle cx="540" cy="980" r="80" fill="none" stroke="#5ee7ff" stroke-opacity="0.2" stroke-width="1.5"/>
    <text x="540" y="990" font-size="48" fill="#00ff88" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700">◎</text>`;
  } else if (scene.id === "features" && scene.features) {
    body = `
    <text x="540" y="560" font-size="48" fill="#dcffbe" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700">${headline}</text>
    ${renderFeatures(scene.features)}`;
  } else if (scene.id === "cta") {
    body = `
    <text x="540" y="720" font-size="72" fill="url(#titleGrad)" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" filter="url(#glow)">${headline}</text>
    <text x="540" y="820" font-size="38" fill="#ffffff" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif">${sub}</text>
    <rect x="190" y="920" width="700" height="120" rx="18" fill="#041008" stroke="#00ff88" stroke-opacity="0.5" stroke-width="2"/>
    <text x="540" y="995" font-size="34" fill="#00ff88" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700">TRY SYNEXUS PRO · LINK IN DESCRIPTION</text>`;
  } else {
    body = `
    ${headlineLines
      .map(
        (line, i) =>
          `<text x="540" y="${680 + i * 72}" font-size="46" fill="#ffffff" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="600">${escapeXml(line)}</text>`,
      )
      .join("\n")}
    <text x="540" y="${680 + headlineLines.length * 72 + 60}" font-size="32" fill="#5ee7ff" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif">${sub}</text>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  ${baseDefs()}
  ${baseBackground()}
  <text x="540" y="140" font-size="28" fill="#5ee7ff" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700" letter-spacing="0.24em">${kicker.toUpperCase()}</text>
  ${body}
  ${footerBar(scene.id === "cta" ? sub : "synexus.pro · you control your funds")}
</svg>`;
}
