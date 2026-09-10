export type CryptoNewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: number;
  body: string;
  categories: string[];
  impact: "high" | "medium" | "watch";
  insight: string;
};

type CryptoCompareArticle = {
  id?: string | number;
  guid?: string;
  title?: string;
  url?: string;
  source?: string;
  source_info?: { name?: string };
  published_on?: number;
  body?: string;
  categories?: string;
};

const HIGH_IMPACT =
  /\b(sec|etf|hack|exploit|ban|lawsuit|fed|rate cut|rate hike|blackrock|binance|coinbase|regulation|crash|rally|approval|reject)\b/i;
const MEDIUM_IMPACT =
  /\b(bitcoin|ethereum|solana|btc|eth|sol|macro|inflation|treasury|whale|listing|partnership|upgrade)\b/i;

function classifyImpact(title: string, categories: string[]): CryptoNewsItem["impact"] {
  const hay = `${title} ${categories.join(" ")}`;
  if (HIGH_IMPACT.test(hay)) return "high";
  if (MEDIUM_IMPACT.test(hay)) return "medium";
  return "watch";
}

function buildInsight(impact: CryptoNewsItem["impact"], categories: string[]): string {
  if (impact === "high") {
    return "High-impact catalyst — watch liquidity, volatility, and risk before acting.";
  }
  if (categories.some((c) => /BTC|ETH|Trading|Market/i.test(c))) {
    return "Market-moving narrative — compare vs. majors and Solana beta before sizing.";
  }
  if (impact === "medium") {
    return "Notable crypto headline — useful context for Titan briefs and Sentinel scans.";
  }
  return "Background intel — track for narrative shift, not an immediate trade signal.";
}

function normalizeArticle(raw: CryptoCompareArticle): CryptoNewsItem | null {
  const title = raw.title?.trim();
  const url = raw.url?.trim();
  if (!title || !url) return null;
  const categories = (raw.categories ?? "")
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean);
  const impact = classifyImpact(title, categories);
  return {
    id: String(raw.id ?? raw.guid ?? url),
    title,
    url,
    source: raw.source_info?.name?.trim() || raw.source?.trim() || "Crypto wire",
    publishedAt: (raw.published_on ?? 0) * 1000,
    body: (raw.body ?? "").trim().slice(0, 280),
    categories,
    impact,
    insight: buildInsight(impact, categories),
  };
}

/** Live world crypto news via CryptoCompare public endpoint. */
export async function fetchCryptoNewsIntel(limit = 36): Promise<CryptoNewsItem[]> {
  const response = await fetch(
    `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&extraParams=synexus`,
  );
  if (!response.ok) {
    throw new Error("News feed unavailable right now.");
  }
  const json = (await response.json()) as { Data?: CryptoCompareArticle[] };
  const items = (json.Data ?? [])
    .map(normalizeArticle)
    .filter((item): item is CryptoNewsItem => Boolean(item))
    .slice(0, limit);

  if (!items.length) {
    throw new Error("No news articles returned.");
  }
  return items;
}

export function formatNewsTime(ms: number): string {
  if (!ms) return "Just now";
  const delta = Date.now() - ms;
  const mins = Math.max(1, Math.round(delta / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
