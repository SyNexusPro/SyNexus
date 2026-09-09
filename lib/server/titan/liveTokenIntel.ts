/**
 * Verified live token snapshot for Hera (DexScreener).
 * Each field is tagged LIVE or UNAVAILABLE — never invent missing numbers.
 */

export const SYN_MINT_DEFAULT = "9naVtLAGKWYuEcGehe1BZ3DpiSLHjSNsaeFr2JPHpump";

export type HeraLiveMeta = {
  ok: boolean;
  source: "DexScreener" | "GeckoTerminal";
  capturedAt: number;
  asOfIso: string;
  asOfLocal: string;
  symbol?: string;
  name?: string;
  mint?: string;
  pairUrl?: string;
  live: string[];
  unavailable: string[];
};

type DexPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  priceUsd?: string | number;
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  volume?: { h24?: number; h6?: number; h1?: number; m5?: number };
  priceChange?: { h24?: number; h6?: number; h1?: number; m5?: number };
  liquidity?: { usd?: number };
  txns?: { h24?: { buys?: number; sells?: number } };
  baseToken?: { address?: string; name?: string; symbol?: string };
};

function synMint(): string {
  return (
    process.env.SYN_MINT?.trim() ||
    process.env.VITE_SYN_MINT?.trim() ||
    SYN_MINT_DEFAULT
  );
}

export function extractSolanaMint(text: string): string | null {
  const m = text.match(/\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/);
  return m?.[1] ?? null;
}

export function mentionsSyn(text: string): boolean {
  return /\b(synexus|syn[- ]coin|syn[- ]token|syn)\b/i.test(text);
}

export function isTokenMetricFollowUp(text: string): boolean {
  return /\b(liquidity|volume|holders?|holder count|market ?cap|mcap|fdv|the price|price now|risk band|the (token|coin|pair)|what about (it|that)|and (its |the )?(liq|liquidity|volume|holders?))\b/i.test(
    text,
  );
}

export function needsLiveTokenFetch(
  message: string,
  opts: { intentHint?: string | null; focusMint?: string | null } = {},
): boolean {
  if (opts.focusMint) return true;
  if (opts.intentHint === "token_lookup" || opts.intentHint === "trade_decision") return true;
  if (mentionsSyn(message)) return true;
  if (extractSolanaMint(message)) return true;
  if (/\$[A-Za-z]{2,12}\b/.test(message)) return true;
  if (/\bwhat'?s going on with\b/i.test(message)) return true;
  if (/\b(price|liquidity|volume|mcap|holders?|market cap) (of|for|on)\b/i.test(message)) return true;
  if (isTokenMetricFollowUp(message)) return true;
  return false;
}

function formatAsOfClock(date: Date, timeZone?: string | null): string {
  const opts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
    ...(timeZone ? { timeZone } : { timeZone: "UTC" }),
  };
  try {
    return date.toLocaleTimeString("en-US", opts);
  } catch {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: "UTC",
      timeZoneName: "short",
    });
  }
}

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(n) ? n : null;
}

function usd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toPrecision(4)}`;
}

function pct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function line(label: string, value: number | null, format: (n: number) => string): { text: string; live: boolean } {
  if (value == null) return { text: `${label}: UNAVAILABLE`, live: false };
  return { text: `${label}: LIVE ${format(value)}`, live: true };
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`dex_fetch_${res.status}`);
  return res.json();
}

function pickPair(pairs: DexPair[], mint?: string | null, symbol?: string | null): DexPair | null {
  const sol = pairs.filter((p) => (p.chainId || "").toLowerCase() === "solana");
  const pool = sol.length ? sol : pairs;
  const scored = pool
    .filter((p) => {
      if (mint && p.baseToken?.address === mint) return true;
      if (symbol && p.baseToken?.symbol?.toUpperCase() === symbol.toUpperCase()) return true;
      if (!mint && !symbol) return true;
      return !symbol;
    })
    .sort((a, b) => (num(b.liquidity?.usd) ?? 0) - (num(a.liquidity?.usd) ?? 0));
  return scored[0] ?? pool.sort((a, b) => (num(b.liquidity?.usd) ?? 0) - (num(a.liquidity?.usd) ?? 0))[0] ?? null;
}

type GeckoPool = {
  attributes?: {
    address?: string;
    name?: string;
    token_price_usd?: string;
    fdv_usd?: string;
    reserve_in_usd?: string;
    volume_usd?: { h24?: string };
    price_change_percentage?: { m5?: string; h1?: string; h24?: string };
    transactions?: { h24?: { buys?: number; sells?: number } };
  };
  relationships?: {
    base_token?: { data?: { id?: string } };
    dex?: { data?: { id?: string } };
  };
};

async function fetchGeckoTokenSnapshot(
  mint: string,
  asOfLocal: string,
  asOfIso: string,
  captured: Date,
): Promise<{ brief: string; meta: HeraLiveMeta } | null> {
  try {
    const json = (await fetchJson(
      `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${encodeURIComponent(mint)}/pools`,
    )) as { data?: GeckoPool[] };
    const pool = Array.isArray(json.data) ? json.data[0] : null;
    const a = pool?.attributes;
    if (!a?.address) return null;

    const price = num(a.token_price_usd);
    const liq = num(a.reserve_in_usd);
    const vol = num(a.volume_usd?.h24);
    const fdv = num(a.fdv_usd);
    const ch24 = num(a.price_change_percentage?.h24);
    const ch1 = num(a.price_change_percentage?.h1);
    const ch5 = num(a.price_change_percentage?.m5);
    const buys = num(a.transactions?.h24?.buys);
    const sells = num(a.transactions?.h24?.sells);
    const rows = [
      line("Price USD", price, usd),
      line("Change 5m", ch5, pct),
      line("Change 1h", ch1, pct),
      line("Change 24h", ch24, pct),
      line("Liquidity USD", liq, usd),
      line("Volume 24h USD", vol, usd),
      line("Market cap USD", null, usd),
      line("FDV USD", fdv, usd),
    ];
    const liveLabels = rows.filter((r) => r.live).map((r) => r.text.split(":")[0]!.trim());
    const unavailableLabels = [
      ...rows.filter((r) => !r.live).map((r) => r.text.split(":")[0]!.trim()),
      "Holders",
      "Top-holder %",
      "Unique wallets",
    ];
    const ticker = (a.name || "SYN").split(" / ")[0] || "SYN";
    const pairUrl = `https://www.geckoterminal.com/solana/pools/${a.address}`;
    const dex = pool?.relationships?.dex?.data?.id || "unknown";
    const brief = [
      `LIVE TOKEN INTELLIGENCE captured at ${asOfLocal} (${asOfIso}).`,
      `Source: GeckoTerminal · ${dex} (DexScreener has not indexed this pair yet).`,
      `Focus token: $${ticker} · mint ${mint}.`,
      "Follow-ups about price, liquidity, volume, holders, or risk refer to THIS token unless a new token is named.",
      "Use ONLY LIVE fields as numbers. If a field is UNAVAILABLE, say it is unavailable — do not guess.",
      ...rows.map((r) => r.text),
      buys != null || sells != null
        ? `24h txns: LIVE buys ${buys ?? "UNAVAILABLE"} / sells ${sells ?? "UNAVAILABLE"}`
        : "24h txns: UNAVAILABLE",
      "Holders / top-wallet % / unique wallets: UNAVAILABLE.",
      `Pair URL: ${pairUrl}`,
      `End financial answers with: ✓ Data as of ${asOfLocal} · GeckoTerminal`,
    ].join("\n");
    return {
      brief,
      meta: {
        ok: true,
        source: "GeckoTerminal",
        capturedAt: captured.getTime(),
        asOfIso,
        asOfLocal,
        symbol: ticker,
        name: ticker,
        mint,
        pairUrl,
        live: liveLabels,
        unavailable: unavailableLabels,
      },
    };
  } catch {
    return null;
  }
}

function isSynSymbol(symbol?: string | null): boolean {
  return (symbol || "").trim().toUpperCase() === "SYN";
}

export async function resolveLiveTokenQuery(
  message: string,
  focusMint?: string | null,
  focusSymbol?: string | null,
): Promise<{ mint?: string; symbol?: string }> {
  const mintFromText = extractSolanaMint(message);
  if (mintFromText) return { mint: mintFromText };
  if (mentionsSyn(message) || isSynSymbol(focusSymbol)) return { mint: synMint(), symbol: "SYN" };
  const dollar = message.match(/\$([A-Za-z]{2,12})\b/);
  if (dollar?.[1]) {
    const symbol = dollar[1].toUpperCase();
    if (symbol === "SYN") return { mint: synMint(), symbol: "SYN" };
    return { symbol };
  }
  if (focusMint) return { mint: focusMint, symbol: focusSymbol ?? undefined };
  if (isSynSymbol(focusSymbol)) return { mint: synMint(), symbol: "SYN" };
  if (focusSymbol) return { symbol: focusSymbol };
  return {};
}

export async function fetchVerifiedTokenSnapshot(opts: {
  mint?: string | null;
  symbol?: string | null;
  timeZone?: string | null;
}): Promise<{ brief: string; meta: HeraLiveMeta }> {
  const captured = new Date();
  const asOfIso = captured.toISOString();
  const asOfLocal = formatAsOfClock(captured, opts.timeZone);
  const unavailableMeta = (reason: string): { brief: string; meta: HeraLiveMeta } => ({
    brief: [
      `LIVE TOKEN INTELLIGENCE unavailable at ${asOfLocal} (${asOfIso}, DexScreener).`,
      reason,
      "Say live data could not be retrieved. Do not invent price, liquidity, volume, market cap, or holders.",
    ].join("\n"),
    meta: {
      ok: false,
      source: "DexScreener",
      capturedAt: captured.getTime(),
      asOfIso,
      asOfLocal,
      mint: opts.mint ?? undefined,
      symbol: opts.symbol ?? undefined,
      live: [],
      unavailable: ["price", "liquidity", "volume", "marketCap", "holders", "risk"],
    },
  });

  try {
    const mint = opts.mint || (isSynSymbol(opts.symbol) ? synMint() : null);
    const symbol = isSynSymbol(opts.symbol) ? "SYN" : opts.symbol || null;
    let pairs: DexPair[] = [];
    if (mint) {
      const json = (await fetchJson(
        `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`,
      )) as { pairs?: DexPair[] | null };
      pairs = Array.isArray(json.pairs) ? json.pairs : [];
    }
    // Never fuzzy-search "SYN" — DexScreener collides with Synapse and others.
    if (!pairs.length && symbol && !isSynSymbol(symbol)) {
      const json = (await fetchJson(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`,
      )) as { pairs?: DexPair[] | null };
      pairs = Array.isArray(json.pairs) ? json.pairs : [];
    }
    const pair = pickPair(pairs, mint, symbol);
    if (!pair?.baseToken?.symbol) {
      if (mint) {
        const gecko = await fetchGeckoTokenSnapshot(mint, asOfLocal, asOfIso, captured);
        if (gecko) return gecko;
      }
      const which = mint ? `mint ${mint}` : symbol ? `$${symbol}` : "this query";
      return unavailableMeta(`No matching DexScreener pair for ${which}.`);
    }
    if (mint && pair.baseToken.address && pair.baseToken.address !== mint) {
      return unavailableMeta(`DexScreener pair mint mismatch for ${mint}.`);
    }

    const price = num(pair.priceUsd);
    const liq = num(pair.liquidity?.usd);
    const vol = num(pair.volume?.h24);
    const mcap = num(pair.marketCap);
    const fdv = num(pair.fdv);
    const ch24 = num(pair.priceChange?.h24);
    const ch1 = num(pair.priceChange?.h1);
    const ch5 = num(pair.priceChange?.m5);
    const buys = num(pair.txns?.h24?.buys);
    const sells = num(pair.txns?.h24?.sells);

    const rows = [
      line("Price USD", price, usd),
      line("Change 5m", ch5, pct),
      line("Change 1h", ch1, pct),
      line("Change 24h", ch24, pct),
      line("Liquidity USD", liq, usd),
      line("Volume 24h USD", vol, usd),
      line("Market cap USD", mcap, usd),
      line("FDV USD", fdv, usd),
    ];
    const liveLabels = rows.filter((r) => r.live).map((r) => r.text.split(":")[0]!.trim());
    const unavailableLabels = [
      ...rows.filter((r) => !r.live).map((r) => r.text.split(":")[0]!.trim()),
      "Holders",
      "Top-holder %",
      "Unique wallets",
    ];

    const inferred: string[] = [];
    if (liq != null && liq < 15_000) inferred.push("Thin liquidity (inferred from LIVE liquidity, not a DexScreener risk score).");
    if (liq != null && vol != null && liq > 0 && vol / liq >= 3) {
      inferred.push("Volume is high vs liquidity (inferred pressure proxy — not a holder count).");
    }

    const ticker = pair.baseToken.symbol;
    const name = pair.baseToken.name || ticker;
    const pairMint = pair.baseToken.address || mint || "";
    const brief = [
      `LIVE TOKEN INTELLIGENCE captured at ${asOfLocal} (${asOfIso}).`,
      `Source: DexScreener · pair ${pair.dexId ?? "unknown"} · ${pair.chainId ?? "solana"}.`,
      `Focus token: $${ticker} ${name}${pairMint ? ` · mint ${pairMint}` : ""}.`,
      "Follow-ups about price, liquidity, volume, holders, or risk refer to THIS token unless a new token is named.",
      "Use ONLY LIVE fields as numbers. If a field is UNAVAILABLE, say it is unavailable — do not guess.",
      ...rows.map((r) => r.text),
      buys != null || sells != null
        ? `24h txns: LIVE buys ${buys ?? "UNAVAILABLE"} / sells ${sells ?? "UNAVAILABLE"}`
        : "24h txns: UNAVAILABLE",
      "Holders / top-wallet % / unique wallets: UNAVAILABLE (DexScreener does not publish holder concentration).",
      inferred.length ? `Inferred (label as inferred, not as DexScreener facts): ${inferred.join(" ")}` : "",
      pair.url ? `Pair URL: ${pair.url}` : "",
      `End financial answers with: ✓ Data as of ${asOfLocal} · DexScreener`,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      brief,
      meta: {
        ok: true,
        source: "DexScreener",
        capturedAt: captured.getTime(),
        asOfIso,
        asOfLocal,
        symbol: ticker,
        name,
        mint: pairMint,
        pairUrl: pair.url,
        live: liveLabels,
        unavailable: unavailableLabels,
      },
    };
  } catch {
    return unavailableMeta("DexScreener request failed.");
  }
}
