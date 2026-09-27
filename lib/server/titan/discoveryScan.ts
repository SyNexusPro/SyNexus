import type { SupabaseClient } from "@supabase/supabase-js";
import {
  discoveryEventPayload,
  evaluateDiscovery,
  type DiscoveryAssetInput,
  type DiscoveryEvaluation,
} from "./discoveryEval.js";
import { shouldSendInstantPremium } from "./classifyEvent.js";
import { sendPremiumAlert } from "./sendPremiumAlert.js";
import {
  bestPairByMint,
  collectSolanaMints,
  fetchDexJson,
  fetchPairsForMints,
  pairsFromDexPayload,
  type DexPair,
} from "../market/dexscreener.js";

type Env = Record<string, string | undefined>;

function pairToInput(pair: DexPair): DiscoveryAssetInput | null {
  const mint = pair.baseToken?.address;
  const symbol = pair.baseToken?.symbol;
  if (!mint || !symbol) return null;
  if ((pair.chainId || "").toLowerCase() !== "solana") return null;

  const buys = pair.txns?.h24?.buys ?? 0;
  const sells = pair.txns?.h24?.sells ?? 0;
  const hasSocials =
    (Array.isArray(pair.info?.socials) && pair.info!.socials!.length > 0) ||
    (Array.isArray(pair.info?.websites) && pair.info!.websites!.length > 0);

  return {
    symbol,
    name: pair.baseToken?.name || symbol,
    chain: "solana",
    contractAddress: mint,
    priceUsd: Number(pair.priceUsd) || null,
    change24hPct: Number(pair.priceChange?.h24) || 0,
    priceMove1hPct: Number(pair.priceChange?.h1) || 0,
    liquidityUsd: Number(pair.liquidity?.usd) || 0,
    volume24hUsd: Number(pair.volume?.h24) || 0,
    pairCreatedAtMs: typeof pair.pairCreatedAt === "number" ? pair.pairCreatedAt : null,
    txCount24h: buys + sells,
    boostAmount: Number(pair.boosts?.active) || 0,
    hasSocials,
  };
}

/** Pull emerging Solana pairs from current DexScreener boost, profile, and takeover feeds. */
export async function scanEmergingSolanaAssets(limit = 24): Promise<DiscoveryEvaluation[]> {
  const mintSet = new Set(await collectSolanaMints(30));

  if (mintSet.size < 6) {
    try {
      const search = await fetchDexJson("https://api.dexscreener.com/latest/dex/search?q=SOL");
      for (const pair of pairsFromDexPayload(search)) {
        const addr = pair.baseToken?.address;
        if (addr && addr !== "So11111111111111111111111111111111111111112") mintSet.add(addr);
        if (mintSet.size >= 30) break;
      }
    } catch {
      /* ignore */
    }
  }

  const mints = [...mintSet].slice(0, Math.min(limit, 30));
  if (!mints.length) return [];

  const evaluations: DiscoveryEvaluation[] = [];
  for (const pair of bestPairByMint(await fetchPairsForMints(mints)).values()) {
    const input = pairToInput(pair);
    if (!input) continue;
    const evaluation = evaluateDiscovery(input);
    if (evaluation.shouldReport) evaluations.push(evaluation);
  }

  return evaluations
    .sort((a, b) => b.discoveryScore + b.momentumScore - (a.discoveryScore + a.momentumScore))
    .slice(0, limit);
}

export async function persistDiscoveryEvaluations(
  admin: SupabaseClient,
  evaluations: DiscoveryEvaluation[],
  env: Env,
): Promise<{ inserted: number; notified: number; pushed: number }> {
  let inserted = 0;
  let notified = 0;
  let pushed = 0;

  for (const evaluation of evaluations) {
    const payload = discoveryEventPayload(evaluation);

    // Dedupe: skip if same mint scored in last 2 hours
    if (evaluation.contractAddress) {
      const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: existing } = await admin
        .from("titan_events")
        .select("id")
        .eq("type", "DISCOVERY_SCORE")
        .eq("token_address", evaluation.contractAddress)
        .gte("created_at", since)
        .limit(1);
      if (existing?.length) continue;
    }

    const { data: event, error } = await admin
      .from("titan_events")
      .insert({
        type: payload.type,
        title: payload.title,
        summary: payload.summary,
        symbol: payload.symbol,
        token_address: payload.tokenAddress,
        severity: payload.severity,
        metadata: payload.metadata,
      })
      .select("id")
      .single();

    if (error || !event) continue;
    inserted++;

    if (shouldSendInstantPremium(payload.severity)) {
      const fanout = await sendPremiumAlert(
        admin,
        {
          eventId: event.id,
          title: payload.title,
          message: payload.summary,
          priority: payload.severity,
        },
        env,
      );
      notified += fanout.notified;
      pushed += fanout.pushed;
    }
  }

  return { inserted, notified, pushed };
}
