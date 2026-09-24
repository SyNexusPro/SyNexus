import { useMemo } from "react";
import { buildTokenFromPartial, type Token } from "../data/tokens";
import { useRealtimeDashboard } from "./realtime/useRealtimeDashboard";
import type { TapeToken } from "./realtime/types";

type OracleMarketFeed = {
  tokens: Token[];
  feedSource: "live" | "mock";
  loading: boolean;
};

type Options = {
  enabled?: boolean;
  intervalMs?: number;
};

function toToken(row: TapeToken): Token {
  return buildTokenFromPartial({
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    priceUsd: row.priceUsd,
    change24hPct: row.change24hPct,
    mintAddress: row.mint,
    marketCapUsd: row.marketCapUsd,
    liquidityUsd: row.liquidityUsd,
    volume24hUsd: row.volume24hUsd,
  });
}

/** Shared tape from RealtimeManager — no per-page price polling. */
export function useOracleMarketFeed(options: Options | number = 10_000): OracleMarketFeed {
  const enabled = typeof options === "number" ? true : (options.enabled ?? true);
  const dash = useRealtimeDashboard();
  const tokens = useMemo(() => (enabled ? dash.tokens.map(toToken) : []), [dash.tokens, enabled]);
  return {
    tokens,
    feedSource: dash.source === "live" ? "live" : "mock",
    loading: false,
  };
}
