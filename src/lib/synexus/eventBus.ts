/**
 * In-process SyNexus events for Hera. Read-only. No network, no wallet actions.
 * Hera keeps a short log of what this session actually emitted.
 */

export type SynexusEventName =
  | "TOKEN_DISCOVERED"
  | "NEW_POOL"
  | "PRICE_CHANGED"
  | "LIQUIDITY_CHANGED"
  | "LARGE_TRADE"
  | "RISK_CHANGED"
  | "SOCIAL_POST_CREATED"
  | "TOKEN_MENTIONED"
  | "CONTENT_REPORTED"
  | "ALERT_TRIGGERED"
  | "PROVIDER_DOWN"
  | "PROVIDER_RECOVERED"
  | "SYSTEM_ERROR";

export type SynexusEvent = {
  name: SynexusEventName;
  at: number;
  detail: string;
  mint?: string | null;
  source?: string | null;
};

type Listener = (event: SynexusEvent) => void;

const listeners = new Set<Listener>();
const recent: SynexusEvent[] = [];
const MAX_RECENT = 40;

const providerOk = new Map<string, boolean>();
const providerStatus = new Map<string, { ok: boolean; at: number; error?: string }>();

export function subscribeSynexusEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitSynexusEvent(event: SynexusEvent): void {
  recent.push(event);
  if (recent.length > MAX_RECENT) recent.shift();
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      /* a subscriber must not break the publisher */
    }
  }
}

export function recentSynexusEvents(limit = 12): SynexusEvent[] {
  return recent.slice(-limit);
}

export type ProviderHealth = { provider: string; ok: boolean; at: number; error?: string };

export function noteProviderHealth(provider: string, ok: boolean, error?: string): void {
  const prev = providerOk.get(provider);
  providerOk.set(provider, ok);
  providerStatus.set(provider, { ok, at: Date.now(), error: ok ? undefined : error });
  if (prev === undefined && ok) return;
  if (prev === ok) return;
  emitSynexusEvent({
    name: ok ? "PROVIDER_RECOVERED" : "PROVIDER_DOWN",
    at: Date.now(),
    source: provider,
    detail: ok ? `${provider} responded again.` : `${provider} failed${error ? `: ${error}` : "."}`,
  });
}

export function readProviderHealth(): ProviderHealth[] {
  return [...providerStatus.entries()].map(([provider, row]) => ({
    provider,
    ok: row.ok,
    at: row.at,
    error: row.error,
  }));
}

const seenPosts = new Set<string>();

export function publishAuthorizedPosts(
  posts: Array<{ id: string; authorHandle: string | null; authorName: string; body: string }>,
): void {
  for (const post of posts) {
    if (!post.id || seenPosts.has(post.id)) continue;
    seenPosts.add(post.id);
    const who = post.authorHandle ? `@${post.authorHandle}` : post.authorName;
    emitSynexusEvent({
      name: "SOCIAL_POST_CREATED",
      at: Date.now(),
      source: "community",
      detail: `${who}: ${post.body.slice(0, 180)}`,
    });
    if (/\$[A-Za-z]{2,12}\b/.test(post.body) || /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/.test(post.body)) {
      emitSynexusEvent({
        name: "TOKEN_MENTIONED",
        at: Date.now(),
        source: "community",
        detail: `${who} mentioned a token in a post you can read.`,
      });
    }
  }
}
