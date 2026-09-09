/** Client bus + types for Hera's visible LIVE verification stamp. */

export type HeraLiveMeta = {
  ok: boolean;
  source: "DexScreener" | string;
  capturedAt: number;
  asOfIso?: string;
  asOfLocal?: string;
  symbol?: string;
  name?: string;
  mint?: string;
  pairUrl?: string;
  live?: string[];
  unavailable?: string[];
};

type Listener = (meta: HeraLiveMeta) => void;

const listeners = new Set<Listener>();
let last: HeraLiveMeta | null = null;

export function getHeraLiveMeta(): HeraLiveMeta | null {
  return last;
}

export function publishHeraLiveMeta(meta: HeraLiveMeta): void {
  last = meta;
  for (const fn of listeners) fn(meta);
}

export function subscribeHeraLiveMeta(fn: Listener): () => void {
  listeners.add(fn);
  if (last) fn(last);
  return () => {
    listeners.delete(fn);
  };
}

export async function fetchHeraLiveToken(opts?: {
  mint?: string | null;
  symbol?: string | null;
  tz?: string | null;
}): Promise<HeraLiveMeta | null> {
  const params = new URLSearchParams();
  if (opts?.mint) params.set("mint", opts.mint);
  if (opts?.symbol) params.set("symbol", opts.symbol);
  if (opts?.tz) params.set("tz", opts.tz);
  const qs = params.toString();
  try {
    const res = await fetch(`/api/hera/live-token${qs ? `?${qs}` : ""}`);
    const json = (await res.json()) as HeraLiveMeta;
    if (!json || typeof json.capturedAt !== "number") return null;
    publishHeraLiveMeta(json);
    return json;
  } catch {
    return null;
  }
}

export type HeraLaunchWatchMeta = {
  ok: boolean;
  source: string;
  capturedAt: number;
  asOfIso?: string;
  count?: number;
  brief?: string;
  leads?: Array<{
    source: string;
    kind: string;
    title: string;
    symbol: string | null;
    mint: string | null;
    url: string | null;
    ageMin: number;
  }>;
};

export async function fetchHeraLaunchWatch(opts?: { tz?: string | null }): Promise<HeraLaunchWatchMeta | null> {
  const params = new URLSearchParams();
  if (opts?.tz) params.set("tz", opts.tz);
  const qs = params.toString();
  try {
    const res = await fetch(`/api/hera/launch-watch${qs ? `?${qs}` : ""}`);
    const json = (await res.json()) as HeraLaunchWatchMeta;
    if (!json || typeof json.capturedAt !== "number") return null;
    return json;
  } catch {
    return null;
  }
}
