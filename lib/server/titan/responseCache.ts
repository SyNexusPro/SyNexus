/** Short-lived Titan answer cache for identical fast crypto asks (per isolate). */

type Entry = { text: string; expiresAt: number };

const store = new Map<string, Entry>();
const MAX = 200;

function hashKey(parts: string[]): string {
  const raw = parts.join("|");
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
  return `t${h}`;
}

export function titanCacheGet(keyParts: string[]): string | null {
  const key = hashKey(keyParts);
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.text;
}

export function titanCacheSet(keyParts: string[], text: string, ttlMs = 8_000): void {
  if (!text || text.length < 8) return;
  if (store.size >= MAX) {
    const first = store.keys().next().value;
    if (first) store.delete(first);
  }
  store.set(hashKey(keyParts), { text, expiresAt: Date.now() + ttlMs });
}
