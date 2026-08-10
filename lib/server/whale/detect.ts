import type { WhaleEventInput } from "./config.js";
import { whaleMinUsd } from "./config.js";

/**
 * Parse Helius enhanced-transaction webhook payloads into whale buy events.
 * Docs: https://docs.helius.dev/webhooks/webhook-payloads
 */
export function parseHeliusWhaleEvents(
  payload: unknown,
  env: Record<string, string | undefined>,
): WhaleEventInput[] {
  const minUsd = whaleMinUsd(env);
  const rows = Array.isArray(payload) ? payload : payload ? [payload] : [];
  const out: WhaleEventInput[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const tx = row as Record<string, unknown>;
    const signature =
      typeof tx.signature === "string"
        ? tx.signature
        : typeof tx.transactionSignature === "string"
          ? tx.transactionSignature
          : null;

    const events = Array.isArray(tx.events) ? tx.events : [];
    for (const ev of events) {
      if (!ev || typeof ev !== "object") continue;
      const e = ev as Record<string, unknown>;
      const swap = (e.swap || e) as Record<string, unknown>;
      const tokenInputs = Array.isArray(swap.tokenInputs) ? swap.tokenInputs : [];
      const tokenOutputs = Array.isArray(swap.tokenOutputs) ? swap.tokenOutputs : [];

      // Prefer largest USD-like field on outputs (buy of token)
      for (const outTok of tokenOutputs) {
        if (!outTok || typeof outTok !== "object") continue;
        const t = outTok as Record<string, unknown>;
        const mint = typeof t.mint === "string" ? t.mint : null;
        if (!mint) continue;
        const usd =
          Number(t.tokenAmount ?? t.amount ?? t.rawTokenAmount ?? 0) > 0
            ? Number(t.usdValue ?? t.usd_amount ?? t.valueUsd ?? swap.usdValue ?? 0)
            : Number(t.usdValue ?? t.usd_amount ?? 0);
        // Helius may put USD on nativeInput
        const nativeIn = swap.nativeInput as Record<string, unknown> | undefined;
        const fallbackUsd = Number(nativeIn?.usdValue ?? nativeIn?.amount ?? 0);
        const usdAmount = Number.isFinite(usd) && usd > 0 ? usd : fallbackUsd;
        if (!Number.isFinite(usdAmount) || usdAmount < minUsd) continue;

        const wallet =
          typeof swap.wallet === "string"
            ? swap.wallet
            : typeof tx.feePayer === "string"
              ? tx.feePayer
              : null;

        out.push({
          mint,
          symbol: typeof t.symbol === "string" ? t.symbol : null,
          side: "buy",
          usdAmount,
          wallet,
          txSignature: signature,
          source: "helius",
          meta: { type: e.type ?? "SWAP" },
        });
      }

      // Also handle tokenTransfers with large USD if present
      void tokenInputs;
    }

    // Alternate shape: tokenTransfers[]
    const transfers = Array.isArray(tx.tokenTransfers) ? tx.tokenTransfers : [];
    for (const tr of transfers) {
      if (!tr || typeof tr !== "object") continue;
      const t = tr as Record<string, unknown>;
      const mint = typeof t.mint === "string" ? t.mint : null;
      if (!mint) continue;
      const usdAmount = Number(t.tokenAmount ?? t.amount ?? 0);
      // Without USD, skip unless env allows SOL-native heuristic later
      const explicitUsd = Number(t.usdAmount ?? t.usd_amount ?? 0);
      const amount = Number.isFinite(explicitUsd) && explicitUsd > 0 ? explicitUsd : 0;
      if (amount < minUsd) continue;
      out.push({
        mint,
        symbol: typeof t.symbol === "string" ? t.symbol : null,
        side: "buy",
        usdAmount: amount,
        wallet: typeof t.toUserAccount === "string" ? t.toUserAccount : null,
        txSignature: signature,
        source: "helius",
        meta: { via: "tokenTransfers" },
      });
    }
  }

  return dedupe(out);
}

/** DexScreener volume-spike proxy when Helius is offline (not a true single-wallet buy). */
export async function detectDexVolumeWhales(
  mints: string[],
  env: Record<string, string | undefined>,
): Promise<WhaleEventInput[]> {
  const minUsd = whaleMinUsd(env);
  const out: WhaleEventInput[] = [];
  for (const mint of mints.slice(0, 20)) {
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        pairs?: {
          baseToken?: { address?: string; symbol?: string };
          volume?: { h1?: number; m5?: number };
          txns?: { m5?: { buys?: number } };
          priceUsd?: string;
        }[];
      };
      const pair = json.pairs?.[0];
      if (!pair) continue;
      const vol5 = Number(pair.volume?.m5 ?? 0);
      const buys = Number(pair.txns?.m5?.buys ?? 0);
      // Heuristic: high 5m volume with few buys ≈ large average buy
      if (!Number.isFinite(vol5) || vol5 < minUsd) continue;
      const avgBuy = buys > 0 ? vol5 / buys : vol5;
      if (avgBuy < minUsd * 0.6) continue;
      out.push({
        mint: pair.baseToken?.address || mint,
        symbol: pair.baseToken?.symbol ?? null,
        side: "buy",
        usdAmount: Math.round(avgBuy),
        wallet: null,
        txSignature: `dexvol:${mint}:${Math.floor(Date.now() / 60_000)}`,
        source: "dexscreener_volume",
        meta: { vol5m: vol5, buys5m: buys },
      });
    } catch {
      /* skip mint */
    }
  }
  return out;
}

function dedupe(events: WhaleEventInput[]): WhaleEventInput[] {
  const seen = new Set<string>();
  const out: WhaleEventInput[] = [];
  for (const e of events) {
    const key = `${e.txSignature || ""}:${e.mint}:${Math.round(e.usdAmount)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}
