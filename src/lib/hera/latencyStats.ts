/** Nearest-rank percentile. Samples are response delays in milliseconds. */
export function latencyPercentile(samples: readonly number[], percentile: number): number | null {
  const clean = samples.filter((value) => Number.isFinite(value) && value >= 0 && value <= 60_000).sort((a, b) => a - b);
  if (!clean.length) return null;
  const pct = Math.min(100, Math.max(0, percentile));
  const rank = Math.min(clean.length - 1, Math.max(0, Math.ceil((pct / 100) * clean.length) - 1));
  return clean[rank] ?? null;
}

export function summarizeLatency(samples: readonly number[]): { count: number; p50: number | null; p95: number | null } {
  return {
    count: samples.filter((value) => Number.isFinite(value) && value >= 0 && value <= 60_000).length,
    p50: latencyPercentile(samples, 50),
    p95: latencyPercentile(samples, 95),
  };
}
