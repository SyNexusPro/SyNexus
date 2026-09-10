import type { SupabaseClient } from "@supabase/supabase-js";
import {
  discoveryEventPayload,
  evaluateDiscovery,
  type DiscoveryAssetInput,
  type DiscoveryEvaluation,
} from "./discoveryEval.js";
import { shouldSendInstantPremium } from "./classifyEvent.js";
import { sendPremiumAlert } from "./sendPremiumAlert.js";

type Env = Record<string, string | undefined>;

type DexPair = {
  chainId?: string;
  pairAddress?: string;
  pairCreatedAt?: number;
  priceUsd?: string | number;
  txns?: { h24?: { buys?: number; sells?: number } };
  volume?: { h24?: number; h1?: number };
  priceChange?: { h24?: number; h1?: number };
  liquidity?: { usd?: number };
  boosts?: { active?: number };
  baseToken?: { address?: string; name?: string; symbol?: string };
  info?: { socials?: unknown[]; websites?: unknown[] };
};

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`fetch ${res.status} ${url}`);
  return res.json();
}

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

/** Pull emerging Solana pairs from DexScreener profile/boost feeds + pair enrichment. */
export async function scanEmergingSolanaAssets(limit = 24): Promise<DiscoveryEvaluation[]> {
  const mintSet = new Set<string>();

  try {
    const boosts = (await fetchJson("https://api.dexscreener.com/token-boosts/top/v1")) as Array<{
      tokenAddress?: string;
      chainId?: string;
    }>;
    for (const row of Array.isArray(boosts) ? boosts : []) {
      if ((row.chainId || "").toLowerCase() !== "solana") continue;
      if (row.tokenAddress) mintSet.add(row.tokenAddress);
    }
  } catch {
    /* optional feed */
  }

  try {
    const profiles = (await fetchJson("https://api.dexscreener.com/token-profiles/latest/v1")) as Array<{
      tokenAddress?: string;
      chainId?: string;
    }>;
    for (const row of Array.isArray(profiles) ? profiles : []) {
      if ((row.chainId || "").toLowerCase() !== "solana") continue;
      if (row.tokenAddress) mintSet.add(row.tokenAddress);
    }
  } catch {
    /* optional feed */
  }

  // Fallback: Solana search for active tape if boost/profile empty
  if (mintSet.size < 6) {
    try {
      const search = (await fetchJson(
        "https://api.dexscreener.com/latest/dex/search?q=SOL",
      )) as { pairs?: DexPair[] };
      for (const pair of search.pairs || []) {
        if ((pair.chainId || "").toLowerCase() !== "solana") continue;
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
  // DexScreener allows comma-separated token addresses
  for (let i = 0; i < mints.length; i += 10) {
    const batch = mints.slice(i, i + 10);
    try {
      const data = (await fetchJson(
        `https://api.dexscreener.com/latest/dex/tokens/${batch.join(",")}`,
      )) as { pairs?: DexPair[] };
      const pairs = data.pairs || [];
      const bestByMint = new Map<string, DexPair>();
      for (const pair of pairs) {
        if ((pair.chainId || "").toLowerCase() !== "solana") continue;
        const mint = pair.baseToken?.address;
        if (!mint) continue;
        const prev = bestByMint.get(mint);
        const liq = Number(pair.liquidity?.usd) || 0;
        const prevLiq = Number(prev?.liquidity?.usd) || 0;
        if (!prev || liq > prevLiq) bestByMint.set(mint, pair);
      }
      for (const pair of bestByMint.values()) {
        const input = pairToInput(pair);
        if (!input) continue;
        const evaluation = evaluateDiscovery(input);
        if (evaluation.shouldReport) evaluations.push(evaluation);
      }
    } catch {
      /* continue other batches */
    }
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
