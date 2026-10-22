type Bucket = { count: number; resetAt: number };

const failures = new Map<string, Bucket>();
const successes = new Map<string, Bucket>();

/** Failed Authorization attempts per IP. In-memory, per server instance. */
export const HERA_INTEL_FAIL_LIMIT = 30;
export const HERA_INTEL_FAIL_WINDOW_MS = 10 * 60 * 1000;

/** Accepted partner requests per key. In-memory, per server instance. */
export const HERA_INTEL_OK_LIMIT = 60;
export const HERA_INTEL_OK_WINDOW_MS = 60 * 1000;

export type RateLimitDecision = { ok: true } | { ok: false; retryAfterSec: number };

function prune(map: Map<string, Bucket>, now: number): void {
  if (map.size <= 5000) return;
  for (const [key, bucket] of map) {
    if (now >= bucket.resetAt) map.delete(key);
  }
}

function take(map: Map<string, Bucket>, key: string, limit: number, windowMs: number): RateLimitDecision {
  const now = Date.now();
  prune(map, now);
  const entry = map.get(key);
  if (!entry || now >= entry.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (entry.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }
  entry.count += 1;
  return { ok: true };
}

export function resetHeraIntelRateLimits(): void {
  failures.clear();
  successes.clear();
}

export function noteHeraIntelFailure(ip: string): RateLimitDecision {
  return take(failures, `ip:${ip}`, HERA_INTEL_FAIL_LIMIT, HERA_INTEL_FAIL_WINDOW_MS);
}

export function noteHeraIntelSuccess(keyId: string): RateLimitDecision {
  return take(successes, `key:${keyId}`, HERA_INTEL_OK_LIMIT, HERA_INTEL_OK_WINDOW_MS);
}
