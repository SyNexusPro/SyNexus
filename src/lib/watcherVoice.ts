const sentinelIdleMessages = [
  "Sentinels are analyzing the market.",
  "The Synexus is scanning risk, momentum, whales, and patterns.",
  "Sentinels are observing liquidity flow across The Synexus.",
  "Sentinels are tracking volume spikes in real time.",
];

/** User-facing risk copy for Sentinel / Synexus intelligence. */
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
  "aegis" | "pulse" | "titan" | "cipher",
  { safe: string; warning: string; danger: string }
> = {
  aegis: {
    safe: "Aegis: security lane clear — contracts, liquidity, and privacy posture look sound.",
    warning: "Aegis: security flags — recheck contract, liquidity, or account hygiene.",
    danger: "Aegis: high-risk security signals — treat as scam/rug until verified.",
  },
  pulse: {
    safe: "Pulse: no abnormal momentum spikes right now.",
    warning: "Pulse: volume moving fast — could be real or a trap.",
    danger: "Pulse: violent price action — verify before chasing.",
  },
  titan: {
    safe: "Titan: whale lanes quiet on this token.",
    warning: "Titan: wallet concentration shifting.",
    danger: "Titan: heavy wallet control — exit risk elevated.",
  },
  cipher: {
    safe: "Cipher: weak signals don't stack into a pattern yet.",
    warning: "Cipher: two lanes starting to agree — watch closely.",
    danger: "Cipher: multi-lane pattern match — Oracle should escalate.",
  },
};

export function getSentinelLaneMessage(
  lane: "aegis" | "pulse" | "titan" | "cipher",
  status: string,
): string {
  const normalized = status.toLowerCase() as "safe" | "warning" | "danger";
  const copy = laneMessages[lane];
  if (normalized === "safe" || normalized === "warning" || normalized === "danger") {
    return copy[normalized];
  }
  return getSentinelMessage(status);
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
