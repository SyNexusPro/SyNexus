export function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function wrapLines(text, width = 42) {
  const words = String(text)
    .replace(/\*\*/g, "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= width) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word.length > width ? word.slice(0, width) : word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 8);
}

export function parseArgs(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  return {
    force: flags.has("--force"),
    watch: flags.has("--watch"),
    upload: flags.has("--upload"),
    noUpload: flags.has("--no-upload"),
    quiet: flags.has("--quiet"),
    help: flags.has("--help") || flags.has("-h"),
  };
}

export function msUntilNextLocalMidnight(now = new Date()) {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

export function formatDuration(sec) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = (s % 60).toFixed(1);
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}
