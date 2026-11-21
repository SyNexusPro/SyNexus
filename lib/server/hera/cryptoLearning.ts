/**
 * Public crypto learning intake for the one Hera memory store.
 * Titles and summaries only — no video downloads, no private accounts.
 */
import { rememberText } from "./memory.js";

type Env = Record<string, string | undefined>;
type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

/** Public education / market channels. Titles enter Hera memory as research notes. */
const YOUTUBE_CHANNELS: { id: string; label: string }[] = [
  { id: "UCqK_GSMbpiV8spgD3ZGloSw", label: "Coin Bureau" },
  { id: "UCsTxLdI3PB6lbNQMTfgykLA", label: "Whiteboard Crypto" },
  { id: "UCjemQfjaXAzAIppNgOWvnow", label: "Bankless" },
  { id: "UCLnQ34Z6sOku9wAFByJ4H8g", label: "CoinMarketCap" },
];

export type CryptoLearningResult = {
  youtubeStored: number;
  newsStored: number;
  skipped: number;
};

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function titlesFromAtom(xml: string): string[] {
  const out: string[] = [];
  const re = /<entry>[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) && out.length < 8) {
    const title = decodeXml(match[1] ?? "");
    if (title.length >= 12) out.push(title.slice(0, 220));
  }
  return out;
}

async function learnYouTubeChannel(
  env: Env,
  channel: { id: string; label: string },
  fetchImpl: FetchImpl,
): Promise<{ stored: number; skipped: number }> {
  let stored = 0;
  let skipped = 0;
  try {
    const response = await fetchImpl(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channel.id)}`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!response.ok) return { stored: 0, skipped: 1 };
    const xml = await response.text();
    for (const title of titlesFromAtom(xml)) {
      const content =
        `YouTube crypto lesson from ${channel.label}: "${title}". ` +
        "Treat this as a public headline, not verified trading advice. Confirm live prices before acting.";
      const result = await rememberText(
        env,
        { kind: "research", source: `youtube:${channel.label}`, content },
        fetchImpl,
      );
      if (result === "stored") stored += 1;
      else skipped += 1;
    }
  } catch {
    skipped += 1;
  }
  return { stored, skipped };
}

type NewsArticle = {
  title?: string;
  body?: string;
  url?: string;
  source_info?: { name?: string };
};

async function learnCryptoNews(env: Env, fetchImpl: FetchImpl): Promise<{ stored: number; skipped: number }> {
  let stored = 0;
  let skipped = 0;
  try {
    const response = await fetchImpl(
      "https://min-api.cryptocompare.com/data/v2/news/?lang=EN&extraParams=synexus-hera-learn",
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!response.ok) return { stored: 0, skipped: 1 };
    const json = (await response.json()) as { Data?: NewsArticle[] };
    const articles = Array.isArray(json.Data) ? json.Data.slice(0, 12) : [];
    for (const article of articles) {
      const title = (article.title || "").replace(/\s+/g, " ").trim();
      if (title.length < 12) {
        skipped += 1;
        continue;
      }
      const source = article.source_info?.name?.trim() || "Crypto news";
      const body = (article.body || "").replace(/\s+/g, " ").trim().slice(0, 280);
      const content = body
        ? `Crypto news (${source}): ${title}. ${body}`
        : `Crypto news (${source}): ${title}.`;
      const result = await rememberText(
        env,
        { kind: "research", source: `news:${source}`, content: content.slice(0, 900) },
        fetchImpl,
      );
      if (result === "stored") stored += 1;
      else skipped += 1;
    }
  } catch {
    skipped += 1;
  }
  return { stored, skipped };
}

/** Pull public YouTube titles and crypto headlines into the shared Hera memory store. */
export async function ingestCryptoLearning(
  env: Env,
  fetchImpl: FetchImpl = fetch,
): Promise<CryptoLearningResult> {
  let youtubeStored = 0;
  let newsStored = 0;
  let skipped = 0;
  for (const channel of YOUTUBE_CHANNELS) {
    const part = await learnYouTubeChannel(env, channel, fetchImpl);
    youtubeStored += part.stored;
    skipped += part.skipped;
  }
  const news = await learnCryptoNews(env, fetchImpl);
  newsStored += news.stored;
  skipped += news.skipped;
  return { youtubeStored, newsStored, skipped };
}
