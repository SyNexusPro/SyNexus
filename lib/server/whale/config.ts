export type WhaleSide = "buy" | "sell";

export type WhaleEventInput = {
  mint: string;
  symbol?: string | null;
  side: WhaleSide;
  usdAmount: number;
  wallet?: string | null;
  txSignature?: string | null;
  source: string;
  meta?: Record<string, unknown>;
};

export function whaleMinUsd(env: Record<string, string | undefined>): number {
  const n = Number(env.WHALE_ALERT_MIN_USD ?? 10_000);
  return Number.isFinite(n) && n > 0 ? n : 10_000;
}

export function whaleWebhookSecret(env: Record<string, string | undefined>): string {
  return env.HELIUS_WEBHOOK_SECRET?.trim() || env.WHALE_WEBHOOK_SECRET?.trim() || "";
}

/** Tracked mints for poll fallback (comma-separated). */
export function whaleTrackMints(env: Record<string, string | undefined>): string[] {
  const raw = env.WHALE_TRACK_MINTS?.trim() || "";
  if (!raw) {
    // SOL wrapped + common defaults can be empty — poll no-ops until configured
    return [];
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40);
}
