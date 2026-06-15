import type { SecurityAction } from "./types";

type Bucket = { count: number; windowStart: number };

const DEFAULT_LIMITS: Record<SecurityAction, { max: number; windowMs: number }> = {
  token_scan: { max: 45, windowMs: 60_000 },
  token_report: { max: 8, windowMs: 300_000 },
  bug_report: { max: 5, windowMs: 600_000 },
  auth_sign_in: { max: 8, windowMs: 900_000 },
  auth_sign_up: { max: 4, windowMs: 900_000 },
  api_fetch: { max: 120, windowMs: 60_000 },
  user_input: { max: 200, windowMs: 60_000 },
  plan_check: { max: 30, windowMs: 60_000 },
  clipboard_paste: { max: 20, windowMs: 60_000 },
  oracle_chat: { max: 40, windowMs: 60_000 },
};

export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  check(action: SecurityAction, key = "global"): { allowed: boolean; retryAfterMs: number } {
    const rule = DEFAULT_LIMITS[action];
    const id = `${action}:${key}`;
    const now = Date.now();
    let bucket = this.buckets.get(id);

    if (!bucket || now - bucket.windowStart >= rule.windowMs) {
      bucket = { count: 0, windowStart: now };
      this.buckets.set(id, bucket);
    }

    bucket.count += 1;

    if (bucket.count > rule.max) {
      const retryAfterMs = rule.windowMs - (now - bucket.windowStart);
      return { allowed: false, retryAfterMs: Math.max(1000, retryAfterMs) };
    }

    return { allowed: true, retryAfterMs: 0 };
  }

  reset(action?: SecurityAction, key = "global") {
    if (!action) {
      this.buckets.clear();
      return;
    }
    this.buckets.delete(`${action}:${key}`);
  }
}

export const rateLimiter = new RateLimiter();
