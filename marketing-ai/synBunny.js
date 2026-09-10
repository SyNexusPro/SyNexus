/**
 * Retired — Syn Bunny mascot removed. Brand is SyNexus only.
 * Kept as a stub so legacy imports fail safely and OneDrive cannot restore the old art.
 */

export const MASCOT_NAME = "SyNexus";
export const MASCOT_TAGLINE = "Paste before you ape.";

export function mascotSignOff() {
  return `**${MASCOT_NAME}** · ${MASCOT_TAGLINE}`;
}

export function mascotTelegramLine() {
  return `${MASCOT_NAME} · ${MASCOT_TAGLINE}`;
}

export function renderSynBunnyInline() {
  return "";
}

export function renderSynBunnyStandaloneSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>`;
}

export function getSynBunnyPngPath() {
  return null;
}

export function getSynBunnySvgPath() {
  return null;
}

export function getSynBunnyDataUri() {
  return null;
}

export function clearSynBunnyCache() {}
