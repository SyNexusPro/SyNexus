import { authHeaders } from "./authSession";

export type WhaleEvent = {
  id: string;
  mint: string;
  symbol: string | null;
  side: string;
  usd_amount: number;
  wallet: string | null;
  tx_signature: string | null;
  source: string;
  detected_at: string;
};

export async function fetchRecentWhaleEvents(sinceIso?: string): Promise<WhaleEvent[]> {
  const qs = sinceIso ? `?since=${encodeURIComponent(sinceIso)}` : "";
  const res = await fetch(`/api/whale/events${qs}`, {
    headers: await authHeaders(),
  });
  if (res.status === 403) return [];
  if (!res.ok) return [];
  const json = (await res.json()) as { events?: WhaleEvent[] };
  return json.events ?? [];
}

export function formatWhaleUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

export function titanWhaleBrief(events: WhaleEvent[], operatorName: string): string | null {
  if (!events.length) return null;
  const top = events.slice(0, 5);
  const lines = top.map((e, i) => {
    const ago = relativeAge(e.detected_at);
    return `${i + 1}. ${e.symbol || "Token"} · ${formatWhaleUsd(e.usd_amount)} buy · ${ago}`;
  });
  return `Leviathan whale buys (Pro live), ${operatorName}:\n${lines.join("\n")}\n\nAsk a symbol for the full Sentinel read — you still sign every swap.`;
}

function relativeAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  if (ms < 5_000) return "just now";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  return `${Math.round(ms / 3_600_000)}h ago`;
}
