/**
 * GET /api/dashboard — one Solana tape for the home screen.
 * DexScreener is public. Helius keys stay on the realtime bridge.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { useApiRoute, type ViteDevServer } from "./viteDevServer.js";
import { collectSolanaMints, fetchPairsForMints, type DexPair } from "../../lib/server/market/dexscreener.js";

type Pair = DexPair;

export type DashboardToken = {
  id: string;
  symbol: string;
  name: string;
  mint: string;
  priceUsd: number;
  change24hPct: number;
  marketCapUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  safetyScore: number;
  risk: "SAFE" | "WARNING" | "DANGER";
  createdAt: number;
};

let memory: { at: number; tokens: DashboardToken[] } | null = null;
const TTL_MS = 12_000;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function safety(liquidityUsd: number, change24hPct: number): { safetyScore: number; risk: DashboardToken["risk"] } {
  let score = 42;
  if (liquidityUsd > 250_000) score += 34;
  else if (liquidityUsd > 50_000) score += 18;
  else if (liquidityUsd < 10_000) score -= 18;
  if (Math.abs(change24hPct) > 80) score -= 24;
  else if (Math.abs(change24hPct) > 35) score -= 8;
  const safetyScore = Math.max(6, Math.min(96, Math.round(score)));
  const risk = safetyScore >= 70 ? "SAFE" : safetyScore >= 45 ? "WARNING" : "DANGER";
  return { safetyScore, risk };
}

function toToken(pair: Pair): DashboardToken | null {
  const mint = pair.baseToken?.address?.trim();
  const symbol = pair.baseToken?.symbol?.trim();
  if (!mint || !symbol) return null;
  if ((pair.chainId ?? "").toLowerCase() !== "solana") return null;
  const priceUsd = Number(pair.priceUsd);
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return null;
  const change24hPct = Number(pair.priceChange?.h24 ?? 0);
  const liquidityUsd = Number(pair.liquidity?.usd ?? 0);
  const volume24hUsd = Number(pair.volume?.h24 ?? 0);
  const marketCapUsd = Number(pair.marketCap ?? pair.fdv ?? 0);
  const band = safety(liquidityUsd, change24hPct);
  return {
    id: mint,
    symbol,
    name: pair.baseToken?.name?.trim() || symbol,
    mint,
    priceUsd,
    change24hPct: Number.isFinite(change24hPct) ? change24hPct : 0,
    marketCapUsd: Number.isFinite(marketCapUsd) ? marketCapUsd : 0,
    liquidityUsd: Number.isFinite(liquidityUsd) ? liquidityUsd : 0,
    volume24hUsd: Number.isFinite(volume24hUsd) ? volume24hUsd : 0,
    safetyScore: band.safetyScore,
    risk: band.risk,
    createdAt: Number(pair.pairCreatedAt ?? 0),
  };
}

export async function loadDashboardTokens(): Promise<DashboardToken[]> {
  const now = Date.now();
  if (memory && now - memory.at < TTL_MS) return memory.tokens;
  let pairs = await fetchPairsForMints(await collectSolanaMints(30));
  if (pairs.length < 8) {
    const response = await fetch("https://api.dexscreener.com/latest/dex/search?q=sol");
    if (response.ok) {
      const data = (await response.json()) as { pairs?: Pair[] };
      pairs = pairs.concat(data.pairs ?? []);
    }
  }
  const seenMint = new Set<string>();
  const seenSymbol = new Set<string>();
  const tokens: DashboardToken[] = [];
  const ranked = pairs
    .filter((pair) => (pair.chainId ?? "").toLowerCase() === "solana")
    .sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0));
  for (const pair of ranked) {
    const token = toToken(pair);
    const symbol = token?.symbol.toUpperCase() ?? "";
    if (!token || !symbol || symbol === "SOL" || symbol === "WSOL") continue;
    if (seenMint.has(token.mint) || seenSymbol.has(symbol)) continue;
    seenMint.add(token.mint);
    seenSymbol.add(symbol);
    tokens.push(token);
    if (tokens.length >= 24) break;
  }
  memory = { at: now, tokens };
  return tokens;
}

export async function handleDashboard(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  try {
    const tokens = await loadDashboardTokens();
    sendJson(res, 200, {
      updatedAt: Date.now(),
      tokens,
      alerts: tokens.filter((token) => token.risk === "DANGER").slice(0, 4).map((token) => `${token.symbol} safety ${token.safetyScore}`),
    });
  } catch (err) {
    sendJson(res, 502, { error: err instanceof Error ? err.message : "dashboard unavailable" });
  }
}

export function configureDashboardApi(server: ViteDevServer): void {
  useApiRoute(server, "/api/dashboard", async (req, res, next) => {
    const method = (req as IncomingMessage).method;
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      next();
      return;
    }
    await handleDashboard(req as IncomingMessage, res as ServerResponse);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleDashboard(req, res);
}
