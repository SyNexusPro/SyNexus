import type { Token } from "../data/tokens";
import { synexusRiskBandLabel } from "../data/tokens";
import { resolveInternalCommanderPersona } from "./titanBotName";
import { answerAegisSecurityPrivacyQuestion } from "../config/sentinelAegis";
import { answerHelixQuestion } from "../config/sentinelHelix";
import { SENTINEL_LANE_IDS, sentinelLaneLabel, type SentinelLaneId } from "../config/sentinels";
import { isInstantTitanPath } from "./titanRouting";
import { rememberFavoriteSymbol } from "./titanMemory";
import { evaluateTokenDiscovery, formatDiscoveryBrief } from "./titanDiscovery";

export type OracleSentinelDirective = {
  lane: SentinelLaneId;
  order: string;
  targetSymbol: string | null;
};

export type OracleSentinelReport = {
  lane: SentinelLaneId;
  report: string;
  latencyMs: number;
  precision: number;
};

function formatUsd(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(6)}`;
}

function formatPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function searchOracleTokens(query: string, pool: Token[]): Token[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return pool.filter((token) => {
    const haystack = [token.symbol, token.name, token.id, token.mintAddress ?? ""]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q) || token.symbol.toLowerCase().startsWith(q);
  });
}

const COMMON_WORD =
  /^(what|whats|going|with|about|the|and|for|how|much|tell|me|price|of|on|is|are|was|this|that|your|our|best|today|right|now)$/i;

export function resolveOracleTokenQuery(text: string, pool: Token[]): Token | null {
  const cleaned = text
    .replace(/^(search|find|scan|check|look up|lookup|what about|tell me about|analyze|analyse)\s+/i, "")
    .replace(/\?/g, "")
    .trim();
  if (!cleaned) return null;

  const mintMatch = cleaned.match(/\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/);
  if (mintMatch) {
    const mint = mintMatch[1]!;
    const byMint = pool.find((t) => t.mintAddress === mint);
    if (byMint) return byMint;
  }

  const dollar = cleaned.match(/\$([A-Za-z]{2,12})\b/);
  if (dollar?.[1]) {
    const sym = dollar[1].toUpperCase();
    const hit = pool.find((t) => t.symbol.toUpperCase() === sym);
    if (hit) return hit;
  }

  if (/\b(synexus|syn[- ]coin|syn[- ]token|syn)\b/i.test(cleaned)) {
    const syn = pool.find((t) => t.symbol.toUpperCase() === "SYN" || t.id === "syn-sol");
    if (syn) return syn;
  }

  const byLen = [...pool].sort((a, b) => b.symbol.length - a.symbol.length);
  for (const token of byLen) {
    const sym = token.symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (token.symbol.length <= 2) {
      if (new RegExp(`\\$${sym}\\b|^${sym}$`, "i").test(cleaned)) return token;
      continue;
    }
    if (new RegExp(`(?:\\$${sym}\\b|\\b${sym}\\b)`, "i").test(cleaned)) return token;
  }

  const hits = searchOracleTokens(cleaned, pool);
  const first = cleaned.split(/\s+/)[0] ?? "";
  if (hits[0] && !COMMON_WORD.test(first) && !COMMON_WORD.test(hits[0].symbol)) return hits[0];
  return (
    hits.find((h) => !COMMON_WORD.test(h.symbol) && cleaned.toLowerCase().includes(h.symbol.toLowerCase())) ?? null
  );
}

export function buildTokenIntelBrief(token: Token): string {
  const discovery = evaluateTokenDiscovery(token);
  const lines = [
    `${token.symbol} (${token.name}) · ${synexusRiskBandLabel(token.guardianRisk)} band`,
    `Price ${formatUsd(token.priceUsd)} · 24h ${formatPct(token.change24hPct)}${token.priceMove1hPct != null ? ` · 1h ${formatPct(token.priceMove1hPct)}` : ""}`,
    `Liquidity ${formatUsd(token.liquidityUsd)} · Volume 24h ${formatUsd(token.volume24hUsd)}${token.marketCapUsd != null ? ` · MCap ${formatUsd(token.marketCapUsd)}` : ""}`,
    `Titan discovery ${discovery.discoveryScore}/100 · risk ${discovery.riskScore}/100 · momentum ${discovery.momentumScore}/100 · confidence ${discovery.confidence}${discovery.highRiskReportable ? " · HIGH RISK (reportable)" : ""}`,
  ];

  if (token.riskScore != null) lines.push(`Guardian risk ${token.riskScore}/100 · confidence ${token.confidence ?? "—"}%`);
  if (token.topWalletPct != null) {
    lines.push(
      `Holders: top ${token.topWalletPct}%${token.top5WalletsPct != null ? ` · top5 ${token.top5WalletsPct}%` : ""}${token.tokenAgeHours != null ? ` · age ${token.tokenAgeHours}h` : ""}`,
    );
  }
  if (token.riskReasons?.length) lines.push(`Flags: ${token.riskReasons.slice(0, 4).join("; ")}`);
  if (token.sharpPumpThenDump) lines.push("Pattern: sharp pump-then-dump signal");
  if (token.highVolumeLowLiquidity) lines.push("Pattern: high volume vs thin liquidity");
  if (discovery.whyMoving[0]) lines.push(`Why moving: ${discovery.whyMoving[0]}`);
  lines.push(`Sentinel read: ${token.guardianMessage}`);

  return lines.join("\n");
}

export function buildDiscoveryResearchPacket(token: Token): Record<string, unknown> {
  const evaluation = evaluateTokenDiscovery(token);
  return {
    type: "DISCOVERY_SCORE",
    brief: formatDiscoveryBrief(evaluation),
    discoveryScore: evaluation.discoveryScore,
    riskScore: evaluation.riskScore,
    momentumScore: evaluation.momentumScore,
    confidence: evaluation.confidence,
    facts: evaluation.facts,
    speculation: evaluation.speculation,
    whyMoving: evaluation.whyMoving,
    unusualSignals: evaluation.unusualSignals,
    highRiskReportable: evaluation.highRiskReportable,
    contractAddress: evaluation.contractAddress,
    chain: evaluation.chain,
  };
}

function pickFocus(pool: Token[], lane: SentinelLaneId): Token | null {
  if (!pool.length) return null;

  switch (lane) {
    case "aegis":
      return (
        pool.find((t) => t.guardianRisk === "DANGER") ??
        pool.find((t) => t.guardianRisk === "WARNING") ??
        null
      );
    case "pulse":
      return [...pool].sort((a, b) => Math.abs(b.change24hPct) - Math.abs(a.change24hPct))[0] ?? null;
    case "leviathan":
      return [...pool].sort((a, b) => (b.topWalletPct ?? 0) - (a.topWalletPct ?? 0))[0] ?? null;
    case "cipher":
      return (
        pool.find((t) => {
          const hits =
            (t.guardianRisk !== "SAFE" ? 1 : 0) +
            (Math.abs(t.change24hPct) >= 10 ? 1 : 0) +
            ((t.topWalletPct ?? 0) >= 22 ? 1 : 0) +
            ((t.riskScore ?? 0) >= 45 ? 1 : 0);
          return hits >= 2;
        }) ?? pool.find((t) => t.guardianRisk !== "SAFE") ??
        null
      );
    case "helix":
      return null;
    default:
      return pool[0] ?? null;
  }
}

export function buildOracleSentinelDirective(
  lane: SentinelLaneId,
  token: Token | null,
  poolSize: number,
): OracleSentinelDirective {
  if (!token) {
    const standby: Record<SentinelLaneId, string> = {
      aegis: "Hold security & privacy watch — token scams, contracts, and operator-safe posture.",
      pulse: "Hold momentum filter — ignore sub-8% moves until volume confirms.",
      leviathan: "Hold whale lane — report any top-wallet shift above 3 points.",
      cipher: "Hold pattern fusion — escalate when two lanes agree on one symbol.",
      helix:
        "Helix standing watch — key hygiene, scan-before-sign, never expose seeds (SyN Wallet on hold).",
    };
    return { lane, order: standby[lane], targetSymbol: null };
  }

  const sym = token.symbol;
  switch (lane) {
    case "aegis":
      return {
        lane,
        targetSymbol: sym,
        order: `Lock security scan on ${sym} — liquidity ${formatUsd(token.liquidityUsd)}, ${synexusRiskBandLabel(token.guardianRisk)} flags, privacy-safe read only.`,
      };
    case "pulse":
      return {
        lane,
        targetSymbol: sym,
        order: `Track ${sym} breakout lane — ${formatPct(token.change24hPct)} 24h must match volume ${formatUsd(token.volume24hUsd)} or discard as noise.`,
      };
    case "leviathan":
      return {
        lane,
        targetSymbol: sym,
        order: `Shadow ${sym} wallets — top holder ${token.topWalletPct ?? "?"}%, alert commander on concentration spikes.`,
      };
    case "cipher":
      return {
        lane,
        targetSymbol: sym,
        order: `Fuse ${sym} signals — cross-check risk, flow, and whales; report fused confidence to commander.`,
      };
    case "helix":
      return {
        lane,
        targetSymbol: null,
        order: `Helix clear on vault — if signing ${sym}, verify mint + destination before approve.`,
      };
    default:
      return { lane, order: `Scan ${poolSize} pairs`, targetSymbol: sym };
  }
}

export function buildSentinelReportToOracle(
  lane: SentinelLaneId,
  token: Token | null,
  _directive: string,
  level: number,
  pro: boolean,
): OracleSentinelReport {
  const baseLatency = Math.max(28, Math.round(96 - level * 11 - (pro ? 18 : 0)));
  const precision = Math.min(99, 78 + level * 4 + (pro ? 5 : 0) + (token ? 3 : 0));

  if (!token) {
    return {
      lane,
      report:
        lane === "helix"
          ? "Helix → commander: key-security lane clear — no signature in flight."
          : "All quiet — standing by for the commander's next order.",
      latencyMs: baseLatency,
      precision,
    };
  }

  const sym = token.symbol;
  let report: string;

  switch (lane) {
    case "aegis":
      report =
        token.guardianRisk === "SAFE"
          ? `Aegis → commander: ${sym} passed contract/liquidity lane — no rug signals in ${baseLatency}ms.`
          : `Aegis → commander: ${sym} ${synexusRiskBandLabel(token.guardianRisk)} — ${token.riskReasons?.[0] ?? "risk elevated"}.`;
      break;
    case "pulse":
      report =
        Math.abs(token.change24hPct) >= 10
          ? `Pulse → commander: ${sym} momentum real at ${formatPct(token.change24hPct)} — volume supports the move.`
          : `Pulse → commander: ${sym} move muted (${formatPct(token.change24hPct)}) — likely noise, not a chase.`;
      break;
    case "leviathan":
      report =
        (token.topWalletPct ?? 0) >= 22
          ? `Leviathan → commander: ${sym} whale control ${token.topWalletPct}% — exit risk elevated.`
          : `Leviathan → commander: ${sym} wallets dispersed — no whale squeeze detected.`;
      break;
    case "cipher":
      report = `Cipher → commander: ${sym} pattern fused — score ${token.riskScore ?? "?"} with ${synexusRiskBandLabel(token.guardianRisk)} alignment.`;
      break;
    case "helix":
      report = `Helix → commander: vault watch active — scan ${sym} before any SyN Wallet signature.`;
      break;
    default:
      report = `${sentinelLaneLabel(lane)} → commander: ${sym} scanned.`;
  }

  return { lane, report, latencyMs: baseLatency, precision };
}

export function buildAllOracleDirectives(tokens: Token[]): Record<SentinelLaneId, OracleSentinelDirective> {
  const lanes: SentinelLaneId[] = [...SENTINEL_LANE_IDS];
  const out = {} as Record<SentinelLaneId, OracleSentinelDirective>;
  for (const lane of lanes) {
    out[lane] = buildOracleSentinelDirective(lane, pickFocus(tokens, lane), tokens.length);
  }
  return out;
}

export function answerCryptoConcept(question: string, commanderName = resolveInternalCommanderPersona()): string | null {
  const q = question.toLowerCase();
  if (/rug pull|rugpull/.test(q)) {
    return "A rug pull is when developers drain liquidity or mint away value — Sentinel Aegis watches liquidity depth, wallet concentration, contract authority, and privacy-safe operator hygiene for exactly this.";
  }
  if (/liquidity/.test(q)) {
    return "Liquidity is how much real money sits in the pool — thin liquidity means slippage and exit risk. Aegis tracks it on every pair and flags traps before you sign.";
  }
  if (/whale/.test(q)) {
    return "Whales are wallets holding large supply — Leviathan tracks top-holder percent and sudden concentration shifts before price reacts.";
  }
  if (/market cap|mcap|fdv/.test(q)) {
    return "Market cap is price × supply — FDV includes locked tokens. SyNexus uses both with volume and liquidity so your commander doesn't chase inflated numbers.";
  }
  if (/solana|sol\b/.test(q) && /what|explain|how/.test(q)) {
    return "Solana is the chain SyNexus scans first — fast blocks, meme velocity, and rug risk. Sentinels watch SPL tokens, pools, and wallet flow in real time.";
  }
  if (/sentinel|aegis|pulse|leviathan|cipher|helix/.test(q) && /what|who|do/.test(q)) {
    return `Aegis guards token/account security, Pulse reads momentum, Leviathan shadows whales, Cipher fuses weak signals, Helix protects SyN Wallet keys and signatures. ${commanderName} commands each lane and reads their reports.`;
  }
  const helixBrief = answerHelixQuestion(q);
  if (helixBrief) return helixBrief;
  const aegisBrief = answerAegisSecurityPrivacyQuestion(q);
  if (aegisBrief) return aegisBrief;
  return null;
}

export function oracleRespondToMessage(text: string, ctx: OracleMessageContext): string {
  if (!isInstantTitanPath(text)) return "";

  const lower = text.toLowerCase().trim();
  const { operatorName: name, tokens, titanBotName } = ctx;

  if (/^(search|find|scan|look up|lookup)\b/.test(lower)) {
    const token = resolveOracleTokenQuery(text, tokens);
    if (token) {
      rememberFavoriteSymbol(token.symbol);
      return `Found ${token.symbol} in ${tokens.length} tracked pairs:\n${buildTokenIntelBrief(token)}\n\nSentinels are on ${token.symbol} — Pulse has live orders.`;
    }
    const partial = searchOracleTokens(text.replace(/[^\w\s]/g, " "), tokens);
    if (partial.length) {
      return `Matches: ${partial.slice(0, 5).map((t) => t.symbol).join(", ")}. Name one for a full sweep.`;
    }
    return `No match in the live feed, ${name}. Try a symbol — e.g. BONK, SOL, SYN.`;
  }

  if (/sentinel|aegis|pulse|leviathan|cipher|helix/.test(lower) && /status|report|doing|orders?/.test(lower)) {
    const dirs = buildAllOracleDirectives(tokens);
    return [
      `Sentinel status — ${titanBotName}:`,
      `Aegis → ${dirs.aegis.order}`,
      `Pulse → ${dirs.pulse.order}`,
      `Leviathan → ${dirs.leviathan.order}`,
      `Cipher → ${dirs.cipher.order}`,
      `Helix → ${dirs.helix.order}`,
    ].join("\n");
  }

  if (/how many|list.*coin|all coin|every coin|tokens/.test(lower)) {
    if (!tokens.length) return `Feed still loading, ${name} — pairs incoming.`;
    const summary = tokens
      .slice(0, 8)
      .map((t) => `${t.symbol} (${synexusRiskBandLabel(t.guardianRisk)})`)
      .join(" · ");
    return `Tracking ${tokens.length} pairs: ${summary}${tokens.length > 8 ? " · …" : ""}. Ask me anything about any of them.`;
  }

  return "";
}

export type OracleMessageContext = {
  operatorName: string;
  titanBotName: string;
  alertCount: number;
  watchlistCount: number;
  plan: "FREE" | "PRO";
  daysSinceLastVisit: number;
  tokens: Token[];
  feedSource: "live" | "mock";
};
