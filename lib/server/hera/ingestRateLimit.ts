type Bucket = { count: number; resetAt: number };

const failures = new Map<string, Bucket>();
const successes = new Map<string, Bucket>();

/** Failed ingest authorizations per IP. In-memory, per server instance. */
export const HERA_INGEST_FAIL_LIMIT = 20;
export const HERA_INGEST_FAIL_WINDOW_MS = 10 * 60 * 1000;

/** Accepted reports per token. Alexus sends at most ~20 per tick (every few minutes) while catching up. */
export const HERA_INGEST_OK_LIMIT = 40;
export const HERA_INGEST_OK_WINDOW_MS = 60 * 1000;

export type IngestRateDecision = { ok: true } | { ok: false; retryAfterSec: number };

function prune(map: Map<string, Bucket>, now: number): void {
  if (map.size <= 5000) return;
  for (const [key, bucket] of map) if (now >= bucket.resetAt) map.delete(key);
}

function take(map: Map<string, Bucket>, key: string, limit: number, windowMs: number): IngestRateDecision {
  const now = Date.now();
  prune(map, now);
  const entry = map.get(key);
  if (!entry || now >= entry.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (entry.count >= limit) return { ok: false, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  entry.count += 1;
  return { ok: true };
}

export function resetHeraIngestRateLimits(): void {
  failures.clear();
  successes.clear();
}

export function noteHeraIngestFailure(ip: string): IngestRateDecision {
  return take(failures, `ip:${ip}`, HERA_INGEST_FAIL_LIMIT, HERA_INGEST_FAIL_WINDOW_MS);
}

export function noteHeraIngestSuccess(keyId: string): IngestRateDecision {
  return take(successes, `key:${keyId}`, HERA_INGEST_OK_LIMIT, HERA_INGEST_OK_WINDOW_MS);
}
