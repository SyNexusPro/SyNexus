import type { Token } from "../../data/tokens";
import { fetchFeed } from "../../community/services/communityFeed";
import { emitSynexusEvent, readProviderHealth, recentSynexusEvents } from "../synexus/eventBus";
import { formatRiskRating, rateRiskBand } from "../token/riskBand";
import { fetchFormingCoins, formatFormingCoins } from "../token/formingCoins";
import { formatResolvedTokens, isAssetAddress, isSolanaMint, resolveTokens } from "../token/resolveTokens";
import type { UniversalToken } from "../token/universalToken";
import { heraRequestIsMutation, heraToolAllowed, type HeraReadTool } from "./permissions";

export type HeraToolResult = {
  tool: HeraReadTool;
  text: string;
};

async function resolveToken(query: string, pool: Token[]): Promise<string> {
  const hits = await resolveTokens(query, pool);
  return formatResolvedTokens(hits);
}

function ratingForHit(hit: UniversalToken, pool: Token[]) {
  const local = pool.find((token) => token.mintAddress === hit.mint);
  if (local?.riskScore != null) {
    return rateRiskBand({
      liquidityUsd: hit.liquidityUsd ?? local.liquidityUsd ?? null,
      volume24hUsd: hit.volume24hUsd ?? local.volume24hUsd ?? null,
      topWalletPct: local.topWalletPct ?? null,
      tokenAgeHours: local.tokenAgeHours ?? null,
      riskyMintOrFreezeAuthorityActive: local.riskyMintOrFreezeAuthorityActive ?? null,
      riskScore: local.riskScore,
      riskReasons: local.riskReasons ?? [],
    });
  }

  const reasons: string[] = [];
  let score: number | null = null;
  if (hit.liquidityUsd != null && hit.liquidityUsd < 5_000) {
    score = 72;
    reasons.push("Liquidity is under $5,000, so exits can fail quickly.");
  } else if (hit.liquidityUsd != null && hit.liquidityUsd < 25_000) {
    score = 45;
    reasons.push("Liquidity is under $25,000, so exits can fail quickly.");
  } else if (hit.liquidityUsd != null) {
    score = 12;
  }
  return rateRiskBand({
    liquidityUsd: hit.liquidityUsd,
    volume24hUsd: hit.volume24hUsd,
    topWalletPct: null,
    tokenAgeHours: null,
    riskyMintOrFreezeAuthorityActive: null,
    riskScore: score,
    riskReasons: reasons,
  });
}

function formatRiskHits(hits: UniversalToken[], pool: Token[]): string {
  if (!hits.length) return "INSUFFICIENT DATA. No token identity came back, so there is no risk rating.";
  return hits
    .slice(0, 4)
    .map((hit) => `${hit.symbol} (${hit.chain} ${hit.mint}): ${formatRiskRating(ratingForHit(hit, pool))}`)
    .join("\n");
}

async function rateRisk(query: string, pool: Token[]): Promise<string> {
  return formatRiskHits(await resolveTokens(query, pool), pool);
}

function providerStatus(): string {
  const rows = readProviderHealth();
  if (!rows.length) return "No provider has been checked in this session yet.";
  return rows
    .map((row) => {
      const when = new Date(row.at).toISOString();
      return row.ok
        ? `${row.provider}: up as of ${when}`
        : `${row.provider}: down as of ${when}${row.error ? ` (${row.error})` : ""}`;
    })
    .join("\n");
}

async function socialSummary(): Promise<string> {
  try {
    const posts = await fetchFeed({ kind: "latest" }, 8);
    if (!posts.length) return "No SyNexus posts are visible to this account right now.";
    return posts
      .map((post) => {
        const who = post.authorHandle ? `@${post.authorHandle}` : post.authorName;
        return `${who} at ${post.createdAt}: ${post.body.slice(0, 220)}`;
      })
      .join("\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Community feed unavailable.";
    return `SyNexus social activity is not available to this account. ${message}`;
  }
}

export async function runHeraTool(name: string, query: string, pool: Token[]): Promise<HeraToolResult | null> {
  if (!heraToolAllowed(name)) return null;
  if (name === "resolve_token") return { tool: name, text: await resolveToken(query, pool) };
  if (name === "rate_risk") return { tool: name, text: await rateRisk(query, pool) };
  if (name === "provider_status") return { tool: name, text: providerStatus() };
  if (name === "forming_coins") return { tool: name, text: formatFormingCoins(await fetchFormingCoins()) };
  return { tool: name, text: await socialSummary() };
}

function extractQuery(text: string): string {
  const evm = text.match(/\b(0x[a-fA-F0-9]{40})\b/);
  if (evm?.[1]) return evm[1];
  const mint = text.match(/\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/);
  if (mint?.[1]) return mint[1];
  const bare = text.trim().match(/^\$?([A-Za-z]{2,12})$/);
  const stop = /^(hi|hey|hello|thanks|thank|help|yes|no|ok|okay|why|what|how|when|status|please|stop|wait|you|hera)$/i;
  if (bare?.[1] && !stop.test(bare[1])) return bare[1];
  const dollar = text.match(/\$([A-Za-z]{2,12})\b/);
  if (dollar?.[1]) return dollar[1];
  const named = text.match(/\b(?:token|coin)\s+([A-Za-z0-9]{2,12})\b/i);
  if (named?.[1] && !/^(is|isn|not|the|this|that|loading|it)$/i.test(named[1])) return named[1];
  return "";
}

/**
 * Read-only context for this turn. Failed tools become a sentence, not a hang.
 */
export async function collectHeraIntelligence(message: string, pool: Token[]): Promise<string | null> {
  const text = message.trim();
  if (!text) return null;

  const lines: string[] = [];
  if (heraRequestIsMutation(text)) {
    lines.push(
      "PERMISSION: Hera cannot transfer funds, execute trades, or change accounts. That action stays with the user.",
    );
  }

  const wantsSocial = /\b(talking about|people (saying|talking)|community|on synexus today|what(?:'s| is) happening)\b/i.test(text);
  const wantsProvider = /\b(isn'?t loading|not loading|won'?t load|provider|rpc|api (down|fail|error)|status)\b/i.test(text);
  const wantsForming =
    /\b(being made|just (created|launched|deployed|minted)|bonding curve|pump\.fun|new pools?|every (?:single )?(?:coin|token)|every platform|any (?:chain|platform)|what(?:'s| is) (?:new|launching)|launch(?:ing|ed|es)?)\b/i.test(
      text,
    );
  const query = extractQuery(text);
  const wantsToken = Boolean(query) || isSolanaMint(text) || isAssetAddress(text) || /\b(risk|scam|safe)\b/i.test(text);

  const jobs: Array<Promise<void>> = [];
  if (wantsToken && query) {
    jobs.push(
      resolveTokens(query, pool)
        .then((hits) => {
          lines.push(`RESOLVED TOKENS:\n${formatResolvedTokens(hits)}`);
          lines.push(`RISK:\n${formatRiskHits(hits, pool)}`);
        })
        .catch((error: unknown) => {
          emitSynexusEvent({
            name: "SYSTEM_ERROR",
            at: Date.now(),
            source: "hera-tools",
            detail: error instanceof Error ? error.message : "Token lookup failed.",
          });
          lines.push("RESOLVED TOKENS: lookup failed. No market numbers were filled in.");
          lines.push("RISK: INSUFFICIENT DATA. The risk check failed.");
        }),
    );
  }
  if (wantsProvider) {
    jobs.push(
      runHeraTool("provider_status", "", pool)
        .then((result) => {
          if (result) lines.push(`PROVIDER STATUS:\n${result.text}`);
        })
        .catch(() => {
          lines.push("PROVIDER STATUS: could not be read.");
        }),
    );
  }
  if (wantsSocial) {
    jobs.push(
      runHeraTool("social_summary", "", pool)
        .then((result) => {
          if (result) lines.push(`AUTHORIZED SYNEXUS POSTS:\n${result.text}`);
        })
        .catch(() => {
          lines.push("AUTHORIZED SYNEXUS POSTS: unavailable.");
        }),
    );
  }
  if (wantsForming) {
    jobs.push(
      runHeraTool("forming_coins", "", pool)
        .then((result) => {
          if (result) lines.push(result.text);
        })
        .catch((error: unknown) => {
          emitSynexusEvent({
            name: "SYSTEM_ERROR",
            at: Date.now(),
            source: "hera-tools",
            detail: error instanceof Error ? error.message : "Forming-coin feeds failed.",
          });
          lines.push("PUBLIC FORMING FEEDS: unavailable. Do not invent coins that were not fetched.");
        }),
    );
  }

  if (!jobs.length && !lines.length) return null;

  await Promise.race([
    Promise.all(jobs),
    new Promise<void>((resolve) => {
      setTimeout(resolve, wantsForming ? 12_000 : 9_000);
    }),
  ]);

  const recent = recentSynexusEvents(6);
  if ((wantsProvider || wantsSocial || wantsForming) && recent.length) {
    lines.push(`RECENT EVENTS:\n${recent.map((event) => `${event.name}: ${event.detail}`).join("\n")}`);
  }

  return lines.length ? lines.join("\n\n") : null;
}
