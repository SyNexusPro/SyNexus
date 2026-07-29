import type { SentinelLaneId } from "../config/sentinels";

const sentinelIdleMessages = [
  "Sentinels are analyzing the market.",
  "The SyNexus grid is scanning security, momentum, whales, and fused patterns.",
  "Aegis, Pulse, Leviathan, and Cipher are observing liquidity flow across The SyNexus.",
  "Sentinels are tracking volume spikes and holder concentration in real time.",
];

/** User-facing risk copy for Sentinel / SyNexus intelligence. */
export function getSentinelMessage(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "safe") {
    return "Sentinels see no immediate threat.";
  }
  if (normalized === "warning") {
    return "Sentinels detected unstable activity.";
  }
  if (normalized === "danger") {
    return "Sentinels advise caution. Multiple risk signals detected.";
  }
  return "Sentinels are observing the network...";
}

const laneMessages: Record<
  SentinelLaneId,
  { safe: string; warning: string; danger: string }
> = {
  aegis: {
    safe: "Aegis: security lane clear — contracts, liquidity, and privacy posture look sound.",
    warning: "Aegis: security flags — recheck contract, liquidity, or account hygiene.",
    danger: "Aegis: high-risk security signals — treat as scam/rug until verified.",
  },
  pulse: {
    safe: "Pulse: momentum integrity normal — no violent volume spikes.",
    warning: "Pulse: volume moving fast — confirm demand before chasing.",
    danger: "Pulse: violent price action with thin support — verify before entry.",
  },
  leviathan: {
    safe: "Leviathan: whale lanes quiet on this token.",
    warning: "Leviathan: holder concentration shifting — watch for distribution.",
    danger: "Leviathan: heavy wallet control — exit liquidity risk elevated.",
  },
  cipher: {
    safe: "Cipher: weak signals don't stack into a pattern yet.",
    warning: "Cipher: two lanes starting to agree — watch closely.",
    danger: "Cipher: multi-lane pattern match — commander should escalate.",
  },
};

export function getSentinelLaneMessage(lane: SentinelLaneId, status: string): string {
  const normalized = status.toLowerCase() as "safe" | "warning" | "danger";
  const copy = laneMessages[lane];
  if (normalized === "safe" || normalized === "warning" || normalized === "danger") {
    return copy[normalized];
  }
  return getSentinelMessage(status);
}

/** Accept legacy "titan" lane id (pre-v2 whale lane naming). */
export function getSentinelLaneMessageLegacy(
  lane: SentinelLaneId | "titan",
  status: string,
): string {
  const id = lane === "titan" ? "leviathan" : lane;
  return getSentinelLaneMessage(id, status);
}

export function getSentinelIdleMessage(seed: number): string {
  return sentinelIdleMessages[Math.abs(seed) % sentinelIdleMessages.length];
}

/** @deprecated Use getSentinelMessage */
export function getWatcherMessage(status: string): string {
  return getSentinelMessage(status);
}

/** @deprecated Use getSentinelIdleMessage */
export function getWatcherIdleMessage(seed: number): string {
  return getSentinelIdleMessage(seed);
}
