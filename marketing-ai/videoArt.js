import { escapeXml, wrapLines } from "./videoUtils.js";
import { renderLogoFooterMark, renderLogoHero, renderLogoWatermark } from "./videoLogo.js";
import { renderSynBunnyInline } from "./synBunny.js";

const W = 1080;
const H = 1920;

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

  let out = `<g id="pcb" opacity="0.95">`;

  for (const d of traces) {
    out += `<path d="${d}" fill="none" stroke="#00ff88" stroke-width="3" stroke-opacity="0.08"/>`;
    out += `<path d="${d}" fill="none" stroke="#89ff2f" stroke-width="1.5" stroke-opacity="0.22" filter="url(#traceGlow)"/>`;
  }

  for (const { x, y, w, h } of chips) {
    out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#041008" stroke="#00ff88" stroke-opacity="0.35" stroke-width="1.5"/>`;
    out += `<rect x="${x + 6}" y="${y + 6}" width="${w - 12}" height="${h - 12}" rx="2" fill="#00ff88" fill-opacity="0.06"/>`;
    for (let i = 0; i < 4; i += 1) {
      out += `<rect x="${x - 5}" y="${y + 10 + i * 12}" width="5" height="4" fill="#00ff88" fill-opacity="0.4"/>`;
      out += `<rect x="${x + w}" y="${y + 10 + i * 12}" width="5" height="4" fill="#00ff88" fill-opacity="0.4"/>`;
    }
  }

  for (const [cx, cy] of nodes) {
    out += `<circle cx="${cx}" cy="${cy}" r="10" fill="#00ff88" fill-opacity="0.12"/>`;
    out += `<circle cx="${cx}" cy="${cy}" r="5" fill="#89ff2f" fill-opacity="0.55" filter="url(#traceGlow)"/>`;
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

function scanLines() {
  let out = "";
  for (let y = 0; y < H; y += 5) {
    out += `<rect x="0" y="${y}" width="${W}" height="1" fill="#00ff88" opacity="0.012"/>`;
  }
  return out;
}

function baseDefs() {
  return `
  <defs>
    <radialGradient id="orbTop" cx="50%" cy="22%" r="65%">
      <stop offset="0%" stop-color="#89ff2f" stop-opacity="0.72"/>
      <stop offset="30%" stop-color="#00ff88" stop-opacity="0.45"/>
      <stop offset="55%" stop-color="#00ffaa" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#010302" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orbMid" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#00ff88" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orbBottom" cx="50%" cy="88%" r="50%">
      <stop offset="0%" stop-color="#00ff88" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a1a12"/>
      <stop offset="45%" stop-color="#030a06"/>
      <stop offset="100%" stop-color="#000000"/>
    </linearGradient>
    <linearGradient id="neon" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#00ff88" stop-opacity="0"/>
      <stop offset="50%" stop-color="#89ff2f" stop-opacity="1"/>
      <stop offset="100%" stop-color="#00ff88" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="titleGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#89ff2f"/>
      <stop offset="45%" stop-color="#dcffbe"/>
      <stop offset="100%" stop-color="#5ee7ff"/>
    </linearGradient>
    <filter id="traceGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4.5" result="blur"/>
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
  ${hexGrid()}
  ${scanLines()}
  <rect x="36" y="36" width="1008" height="1848" rx="28" fill="none" stroke="#00ff88" stroke-opacity="0.32" stroke-width="2.5" filter="url(#traceGlow)"/>
  <rect x="48" y="48" width="984" height="1824" rx="24" fill="none" stroke="#89ff2f" stroke-opacity="0.12" stroke-width="1"/>
  <rect x="0" y="580" width="${W}" height="4" fill="url(#neon)" opacity="0.95" filter="url(#traceGlow)"/>
  <rect x="0" y="1340" width="${W}" height="3" fill="url(#neon)" opacity="0.6" filter="url(#traceGlow)"/>`;
}

function footerBar(sub = "synexus.pro · paste before you buy") {
  return `
  <text x="540" y="1780" font-size="36" fill="#89ff2f" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" letter-spacing="0.14em" filter="url(#glow)">
    PASTE · SCAN · AVOID OR APE
  </text>
  <text x="540" y="1840" font-size="26" fill="#8fb886" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" letter-spacing="0.1em">
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
      <text x="220" y="${y + 62}" font-size="44" fill="#dcffbe" font-family="Segoe UI, Arial, sans-serif" font-weight="800" filter="url(#glow)">${escapeXml(step.label)}</text>
      <text x="220" y="${y + 108}" font-size="28" fill="#8fb886" font-family="Segoe UI, Arial, sans-serif">${escapeXml(step.sub)}</text>`;
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

export function renderSceneSvg(scene) {
  const kicker = escapeXml(scene.kicker || "");
  const headline = scene.headline || "";
  const sub = scene.sub || "";

  let body = "";

  if (scene.id === "intro") {
    body = `
    <text x="540" y="200" font-size="30" fill="#5ee7ff" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700" letter-spacing="0.28em" filter="url(#traceGlow)">SYNEXUS</text>
    ${bigHeadline(headline, 480, 88)}
    ${subLine(sub, 720)}
    ${renderLogoHero({ size: 220, centerY: 1080 })}`;
  } else if (scene.id === "hook") {
    body = `
    ${bigHeadline(headline, 620, 80)}
    ${subLine(sub, 820)}
    <rect x="140" y="920" width="800" height="100" rx="16" fill="#041008" stroke="#00ff88" stroke-opacity="0.6" stroke-width="2" filter="url(#traceGlow)"/>
    <text x="540" y="985" font-size="38" fill="#89ff2f" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" letter-spacing="0.18em" filter="url(#glow)">AVOID · WATCH · OK</text>`;
  } else if (scene.id === "flow" && scene.steps) {
    body = `
    ${bigHeadline(headline, 520, 56)}
    ${renderFlowSteps(scene.steps)}`;
  } else if (scene.id === "cta") {
    body = `
    ${renderLogoHero({ size: 140, centerY: 560 })}
    ${bigHeadline(headline, 720, 96)}
    ${subLine(sub, 880)}
    <rect x="160" y="980" width="760" height="120" rx="22" fill="#041008" stroke="#89ff2f" stroke-opacity="0.7" stroke-width="2.5" filter="url(#megaGlow)"/>
    <text x="540" y="1055" font-size="36" fill="#89ff2f" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" letter-spacing="0.14em">TRY FREE · PASTE A TOKEN</text>`;
  } else {
    body = `
    ${bigHeadline(headline, 680, 64)}
    ${subLine(sub, 680 + wrapLines(headline, 16).length * 80 + 40)}`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  ${baseDefs()}
  ${baseBackground()}
  <text x="540" y="130" font-size="26" fill="#00ff88" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700" letter-spacing="0.26em" opacity="0.9">${kicker.toUpperCase()}</text>
  ${body}
  ${renderSynBunnyInline({ sceneId: scene.id })}
  ${renderLogoWatermark(W, H)}
  ${renderLogoFooterMark()}
  ${footerBar(scene.id === "cta" ? sub : "synexus.pro · you control your funds")}
</svg>`;
}
