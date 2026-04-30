const watcherIdleMessages = [
  "The Watcher is observing liquidity flow across the hive.",
  "The Watcher is observing volume spikes in real time.",
  "The Watcher is observing contract behavior for risk shifts.",
];

export function getWatcherMessage(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "safe") {
    return "The Watcher sees no immediate threat.";
  }
  if (normalized === "warning") {
    return "The Watcher detected unstable activity.";
  }
  if (normalized === "danger") {
    return "The Watcher advises caution. Multiple risk signals detected.";
  }
  return "The Watcher is observing the network...";
}

export function getWatcherIdleMessage(seed: number): string {
  return watcherIdleMessages[Math.abs(seed) % watcherIdleMessages.length];
}
