type CacheEntry<T> = { value: T; expiresAt: number };

const store = new Map<string, CacheEntry<unknown>>();

export function readMoversCache<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function writeMoversCache<T>(key: string, value: T, ttlMs: number): T {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

const inFlight = new Map<string, Promise<unknown>>();

/** Collapse duplicate concurrent fetches (prevents API storms / UI freezes). */
export function dedupeInFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = inFlight.get(key);
  if (hit) return hit as Promise<T>;
  const promise = fn().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}
