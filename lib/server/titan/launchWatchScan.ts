/**
 * Hera launch watch — public surfaces only (no private DMs / closed Discords).
 * On-chain: pump.fun newest coins, GeckoTerminal new Solana pools, DexScreener latest profiles.
 * Social: Reddit launch threads, CryptoCompare launch headlines, optional X recent search.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { shouldSendInstantPremium, type TitanSeverity } from "./classifyEvent.js";
import { sendPremiumAlert } from "./sendPremiumAlert.js";

export type LaunchLeadKind = "onchain_launch" | "social_post" | "news";

export type LaunchLead = {
  id: string;
  source: string;
  kind: LaunchLeadKind;
  title: string;
  summary: string;
  url: string | null;
  symbol: string | null;
  mint: string | null;
  socials: string[];
  createdAtMs: number;
  severity: TitanSeverity;
};

type Env = Record<string, string | undefined>;

const LAUNCH_POST_RE =
  /\b(launch(ing|ed)?|stealth\s*launch|fair\s*launch|going\s*live|just\s+(dropped|launched|deployed)|new\s+(token|coin|ca|ticker)|ca[:\s]|contract\s+address|bonding\s*curve|pump\.fun|ticker\s+is|\$[A-Z]{2,12}\b)\b/i;

const MINT_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

const HEADERS = {
  accept: "application/json",
  "user-agent": "SynexusHera/1.0 (launch-watch; +https://synexus.pro)",
};

async function fetchJson(url: string, extra?: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, {
    headers: { ...HEADERS, ...extra },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`launch_fetch_${res.status}`);
  return res.json();
}

function extractMint(text: string): string | null {
  const hits = text.match(MINT_RE);
  if (!hits) return null;
  const pump = hits.find((h) => h.endsWith("pump"));
  return pump || hits[0] || null;
}

function uniqueSocials(...urls: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const u = (raw || "").trim();
    if (!u || u === "https://" || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out.slice(0, 4);
}

function asMs(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return Date.now();
  return n < 1e12 ? n * 1000 : n;
}

async function settled<T>(task: Promise<T[]>): Promise<T[]> {
  try {
    return await task;
  } catch {
    return [];
  }
}

async function scanPumpFun(): Promise<LaunchLead[]> {
  const rows = (await fetchJson(
    "https://frontend-api-v3.pump.fun/coins?offset=0&limit=24&sort=created_timestamp&order=DESC&includeNsfw=false",
  )) as Array<{
    mint?: string;
    name?: string;
    symbol?: string;
    description?: string;
    twitter?: string;
    telegram?: string;
    website?: string;
    created_timestamp?: number;
    usd_market_cap?: number;
    username?: string;
  }>;
  if (!Array.isArray(rows)) return [];
  const leads: LaunchLead[] = [];
  for (const row of rows) {
    const mint = row.mint?.trim();
    const symbol = (row.symbol || "").trim() || null;
    if (!mint) continue;
    const socials = uniqueSocials(row.twitter, row.telegram, row.website);
    const mcap = Number(row.usd_market_cap) || 0;
    const createdAtMs = asMs(row.created_timestamp);
    const ageMin = Math.max(0, Math.round((Date.now() - createdAtMs) / 60_000));
    const severity: TitanSeverity = socials.length ? "normal" : "low";
    leads.push({
      id: `pump:${mint}`,
      source: "pump.fun",
      kind: "onchain_launch",
      title: `$${symbol || "NEW"} launched on pump.fun`,
      summary: [
        row.name || symbol || "Unnamed",
        ageMin <= 2 ? "just now" : `${ageMin}m old`,
        mcap > 0 ? `mcap ~$${Math.round(mcap).toLocaleString("en-US")}` : null,
        row.username ? `poster @${row.username}` : null,
        socials.length ? `socials: ${socials.join(" · ")}` : "no socials attached",
        (row.description || "").trim().slice(0, 140) || null,
      ]
        .filter(Boolean)
        .join(" · "),
      url: `https://pump.fun/coin/${mint}`,
      symbol,
      mint,
      socials,
      createdAtMs,
      severity,
    });
  }
  return leads;
}

async function scanGeckoNewPools(): Promise<LaunchLead[]> {
  const json = (await fetchJson(
    "https://api.geckoterminal.com/api/v2/networks/solana/new_pools?page=1",
  )) as {
    data?: Array<{
      id?: string;
      attributes?: {
        address?: string;
        name?: string;
        pool_created_at?: string;
        base_token_price_usd?: string;
        fdv_usd?: string;
        reserve_in_usd?: string;
      };
      relationships?: {
        dex?: { data?: { id?: string } };
        base_token?: { data?: { id?: string } };
      };
    }>;
  };
  const leads: LaunchLead[] = [];
  for (const pool of json.data || []) {
    const a = pool.attributes;
    const dex = pool.relationships?.dex?.data?.id || "unknown";
    const tokenId = pool.relationships?.base_token?.data?.id || "";
    const mint = tokenId.replace(/^solana_/i, "") || null;
    const name = a?.name || "New pool";
    const createdAtMs = a?.pool_created_at ? Date.parse(a.pool_created_at) : Date.now();
    if (!Number.isFinite(createdAtMs)) continue;
    const ticker = name.split(" / ")[0] || name;
    leads.push({
      id: `gecko:${a?.address || pool.id || name}`,
      source: `GeckoTerminal · ${dex}`,
      kind: "onchain_launch",
      title: `${name} new Solana pool`,
      summary: [
        dex,
        a?.reserve_in_usd ? `liq $${Number(a.reserve_in_usd).toFixed(0)}` : null,
        a?.fdv_usd ? `fdv $${Number(a.fdv_usd).toFixed(0)}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      url: a?.address ? `https://www.geckoterminal.com/solana/pools/${a.address}` : null,
      symbol: ticker,
      mint,
      socials: [],
      createdAtMs,
      severity: "normal",
    });
  }
  return leads.slice(0, 16);
}

async function scanDexProfiles(): Promise<LaunchLead[]> {
  const rows = (await fetchJson("https://api.dexscreener.com/token-profiles/latest/v1")) as Array<{
    url?: string;
    chainId?: string;
    tokenAddress?: string;
    description?: string;
    links?: Array<{ type?: string; url?: string }>;
  }>;
  if (!Array.isArray(rows)) return [];
  const leads: LaunchLead[] = [];
  for (const row of rows) {
    if ((row.chainId || "").toLowerCase() !== "solana") continue;
    const mint = row.tokenAddress?.trim();
    if (!mint) continue;
    const socials = uniqueSocials(...(row.links || []).map((l) => l.url));
    leads.push({
      id: `dexprofile:${mint}`,
      source: "DexScreener profile",
      kind: "onchain_launch",
      title: "New Solana token profile published",
      summary: (row.description || "Token profile just appeared on DexScreener.").slice(0, 180),
      url: row.url || `https://dexscreener.com/solana/${mint}`,
      symbol: null,
      mint,
      socials,
      createdAtMs: Date.now(),
      severity: socials.length ? "normal" : "low",
    });
  }
  return leads.slice(0, 12);
}

type RedditChild = {
  data?: {
    id?: string;
    title?: string;
    selftext?: string;
    url?: string;
    permalink?: string;
    created_utc?: number;
    subreddit?: string;
    author?: string;
  };
};

async function scanReddit(): Promise<LaunchLead[]> {
  const subs = ["CryptoMoonShots", "solana", "pumpfun", "SatoshiStreetBets"];
  const batches = await Promise.all(
    subs.map(async (sub) => {
      try {
        const json = (await fetchJson(`https://www.reddit.com/r/${sub}/new.json?limit=20&raw_json=1`)) as {
          data?: { children?: RedditChild[] };
        };
        const leads: LaunchLead[] = [];
        for (const child of json.data?.children || []) {
          const d = child.data;
          const title = (d?.title || "").trim();
          const body = (d?.selftext || "").trim();
          const hay = `${title}\n${body}`;
          if (!title || !LAUNCH_POST_RE.test(hay)) continue;
          const permalink = d?.permalink ? `https://www.reddit.com${d.permalink}` : d?.url || null;
          const mint = extractMint(hay);
          leads.push({
            id: `reddit:${d?.id || title}`,
            source: `Reddit r/${d?.subreddit || sub}`,
            kind: "social_post",
            title,
            summary: [
              d?.author ? `u/${d.author}` : null,
              mint ? `mint ${mint}` : "no mint in post",
              body.slice(0, 160) || null,
            ]
              .filter(Boolean)
              .join(" · "),
            url: permalink,
            symbol: title.match(/\$([A-Z]{2,12})\b/)?.[1] || null,
            mint,
            socials: permalink ? [permalink] : [],
            createdAtMs: asMs(d?.created_utc),
            severity: mint ? "high" : "low",
          });
        }
        return leads;
      } catch {
        return [];
      }
    }),
  );
  return batches.flat();
}

async function scanNews(): Promise<LaunchLead[]> {
  const json = (await fetchJson(
    "https://min-api.cryptocompare.com/data/v2/news/?lang=EN&extraParams=synexus-launch-watch",
  )) as { Data?: Array<{ title?: string; url?: string; body?: string; published_on?: number; source_info?: { name?: string } }> };
  const leads: LaunchLead[] = [];
  for (const article of json.Data || []) {
    const title = (article.title || "").trim();
    const hay = `${title} ${article.body || ""}`;
    if (!title || !LAUNCH_POST_RE.test(hay)) continue;
    leads.push({
      id: `news:${article.url || title}`,
      source: article.source_info?.name || "Crypto news",
      kind: "news",
      title,
      summary: (article.body || "").replace(/\s+/g, " ").trim().slice(0, 180),
      url: article.url || null,
      symbol: title.match(/\$([A-Z]{2,12})\b/)?.[1] || null,
      mint: extractMint(hay),
      socials: article.url ? [article.url] : [],
      createdAtMs: asMs(article.published_on),
      severity: "normal",
    });
  }
  return leads.slice(0, 10);
}

async function scanX(env: Env): Promise<LaunchLead[]> {
  const bearer = env.X_BEARER_TOKEN?.trim() || env.TWITTER_BEARER_TOKEN?.trim();
  if (!bearer) return [];
  const query = encodeURIComponent(
    '(launching OR "just launched" OR "stealth launch" OR pump.fun OR "fair launch" OR "new ticker") (solana OR memecoin OR "ca:") -is:retweet lang:en',
  );
  const json = (await fetchJson(
    `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=20&tweet.fields=created_at,author_id`,
    { authorization: `Bearer ${bearer}` },
  )) as {
    data?: Array<{ id?: string; text?: string; created_at?: string }>;
  };
  const leads: LaunchLead[] = [];
  for (const tweet of json.data || []) {
    const text = (tweet.text || "").trim();
    if (!text || !LAUNCH_POST_RE.test(text)) continue;
    const url = tweet.id ? `https://x.com/i/web/status/${tweet.id}` : null;
    const mint = extractMint(text);
    leads.push({
      id: `x:${tweet.id || text.slice(0, 40)}`,
      source: "X",
      kind: "social_post",
      title: text.slice(0, 120),
      summary: mint ? `mint ${mint}` : "Launch chatter — no mint in tweet",
      url,
      symbol: text.match(/\$([A-Z]{2,12})\b/)?.[1] || null,
      mint,
      socials: url ? [url] : [],
      createdAtMs: tweet.created_at ? Date.parse(tweet.created_at) : Date.now(),
      severity: mint ? "high" : "low",
    });
  }
  return leads;
}

function sortLeads(leads: LaunchLead[]): LaunchLead[] {
  return leads.sort((a, b) => b.createdAtMs - a.createdAtMs);
}

function dedupeLeads(leads: LaunchLead[]): LaunchLead[] {
  const seen = new Set<string>();
  const out: LaunchLead[] = [];
  for (const lead of leads) {
    const key = (lead.mint || lead.id).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(lead);
  }
  return out;
}

export async function scanLaunchWatch(env: Env = process.env): Promise<LaunchLead[]> {
  const batches = await Promise.all([
    settled(scanPumpFun()),
    settled(scanGeckoNewPools()),
    settled(scanDexProfiles()),
    settled(scanReddit()),
    settled(scanNews()),
    settled(scanX(env)),
  ]);
  return sortLeads(dedupeLeads(batches.flat())).slice(0, 40);
}

function formatClock(date: Date, timeZone?: string | null): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || undefined,
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function formatLaunchWatchBrief(leads: LaunchLead[], timeZone?: string | null): string {
  const now = new Date();
  const asOfLocal = formatClock(now, timeZone);
  const asOfIso = now.toISOString();
  if (!leads.length) {
    return [
      `LIVE LAUNCH WATCH captured at ${asOfLocal} (${asOfIso}).`,
      "No public launch posts or new Solana coins were retrieved this pass.",
      "Do not invent launches, mints, or social posts.",
    ].join("\n");
  }
  const onchain = leads.filter((l) => l.kind === "onchain_launch").slice(0, 10);
  const social = leads.filter((l) => l.kind !== "onchain_launch").slice(0, 8);
  const line = (lead: LaunchLead) => {
    const ageMin = Math.max(0, Math.round((Date.now() - lead.createdAtMs) / 60_000));
    const age = ageMin <= 1 ? "just now" : `${ageMin}m ago`;
    return `- [${lead.source}] ${lead.title} · ${age}${lead.mint ? ` · mint ${lead.mint}` : ""}${lead.url ? ` · ${lead.url}` : ""} — ${lead.summary}`;
  };
  return [
    `LIVE LAUNCH WATCH captured at ${asOfLocal} (${asOfIso}).`,
    "Public surfaces only: pump.fun newest coins, GeckoTerminal new Solana pools, DexScreener profiles, Reddit launch threads, crypto headlines" +
      (leads.some((l) => l.source === "X") ? ", X recent search" : "") +
      ".",
    "These are leads, not buy signals. Hype is not quality. Separate confirmed on-chain launches from social speculation. Never invent a mint that is not listed.",
    onchain.length ? "Newest on-chain launches:" : "",
    ...onchain.map(line),
    social.length ? "Social / news posts about launches:" : "",
    ...social.map(line),
    `End launch answers with: ✓ Data as of ${asOfLocal} · Launch watch`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function needsLaunchWatchFetch(message: string, intentHint?: string | null): boolean {
  if (intentHint === "launch_watch") return true;
  const lower = message.toLowerCase();
  return (
    /\b(launch(ing|ed)?|stealth|fair launch|going live|new (coin|token|ticker)|pump\.fun|bonding curve|alpha|leads?|being published|just dropped|socials?|twitter|reddit|telegram|x\.com)\b/.test(
      lower,
    ) &&
    /\b(coin|token|crypto|solana|meme|launch|post|anyone|who|what|scan|watch|alpha|lead)\b/.test(lower)
  ) || /\b(anyone posting|what('?s| is) launching|new launches?|launch watch|social scan)\b/.test(lower);
}

export async function persistLaunchLeads(
  admin: SupabaseClient,
  leads: LaunchLead[],
  env: Env,
): Promise<{ inserted: number; notified: number; pushed: number }> {
  let inserted = 0;
  let notified = 0;
  let pushed = 0;
  const persistable: LaunchLead[] = [];
  let pumpKept = 0;
  for (const lead of leads) {
    if (lead.kind === "social_post" && lead.severity === "low" && !lead.mint) continue;
    if (lead.source === "pump.fun") {
      if (!lead.socials.length) continue;
      pumpKept += 1;
      if (pumpKept > 6) continue;
    }
    persistable.push(lead);
  }

  for (const lead of persistable.slice(0, 20)) {
    const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    if (lead.mint) {
      const { data: existingMint } = await admin
        .from("titan_events")
        .select("id")
        .eq("type", "LAUNCH_WATCH")
        .eq("token_address", lead.mint)
        .gte("created_at", since)
        .limit(1);
      if (existingMint?.length) continue;
    } else {
      const { data: existingTitle } = await admin
        .from("titan_events")
        .select("id")
        .eq("type", "LAUNCH_WATCH")
        .eq("title", lead.title.slice(0, 180))
        .gte("created_at", since)
        .limit(1);
      if (existingTitle?.length) continue;
    }

    const { data: event, error } = await admin
      .from("titan_events")
      .insert({
        type: "LAUNCH_WATCH",
        title: lead.title.slice(0, 180),
        summary: lead.summary.slice(0, 600),
        symbol: lead.symbol,
        token_address: lead.mint,
        severity: lead.severity,
        metadata: {
          source: lead.source,
          kind: lead.kind,
          url: lead.url,
          socials: lead.socials,
          leadId: lead.id,
        },
      })
      .select("id")
      .single();

    if (error || !event) continue;
    inserted++;

    if (shouldSendInstantPremium(lead.severity)) {
      const fanout = await sendPremiumAlert(
        admin,
        {
          eventId: event.id,
          title: lead.title,
          message: lead.summary,
          priority: lead.severity,
        },
        env,
      );
      notified += fanout.notified;
      pushed += fanout.pushed;
    }
  }

  return { inserted, notified, pushed };
}

export function launchWatchMeta(leads: LaunchLead[]) {
  const now = Date.now();
  return {
    ok: leads.length > 0,
    source: "Launch watch",
    capturedAt: now,
    asOfIso: new Date(now).toISOString(),
    count: leads.length,
    leads: leads.slice(0, 16).map((lead) => ({
      source: lead.source,
      kind: lead.kind,
      title: lead.title,
      symbol: lead.symbol,
      mint: lead.mint,
      url: lead.url,
      socials: lead.socials,
      ageMin: Math.max(0, Math.round((now - lead.createdAtMs) / 60_000)),
    })),
  };
}
