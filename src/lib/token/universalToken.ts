import { buildTokenFromPartial, type Token } from "../../data/tokens";

/** Mint (plus chain) is the identity. Missing numbers stay null. */
export type TokenSource = "synexus" | "dexscreener" | "geckoterminal" | "pumpfun" | "rpc";

export type UniversalToken = {
  chain: string;
  mint: string;
  pool: string | null;
  exchange: string | null;
  symbol: string;
  name: string;
  priceUsd: number | null;
  change24hPct: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  marketCapUsd: number | null;
  source: TokenSource;
  sources: TokenSource[];
  fetchedAt: number;
  confidence: number;
};

export function tokenKey(token: Pick<UniversalToken, "chain" | "mint">): string {
  return `${token.chain.toLowerCase()}:${token.mint}`;
}

export function universalToToken(token: UniversalToken): Token {
  return buildTokenFromPartial({
    id: token.mint,
    symbol: token.symbol || "???",
    name: token.name || token.symbol || "Unknown",
    priceUsd: token.priceUsd ?? 0,
    change24hPct: token.change24hPct ?? 0,
    volume24hUsd: token.volume24hUsd ?? undefined,
    liquidityUsd: token.liquidityUsd ?? undefined,
    marketCapUsd: token.marketCapUsd ?? undefined,
    mintAddress: token.mint,
  });
}
