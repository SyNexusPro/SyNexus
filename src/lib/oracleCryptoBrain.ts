import type { Token } from "../data/tokens";
import { synexusRiskBandLabel } from "../data/tokens";
import { DEFAULT_TITAN_BOT_NAME } from "../config/titanBot";
import { answerAegisSecurityPrivacyQuestion } from "../config/sentinelAegis";
import type { SentinelLaneId } from "./sentinelIntel";
import { isInstantTitanPath } from "./titanRouting";
import { appendTitanDecisionFooter } from "./titanGuardrails";
import { rememberFavoriteSymbol } from "./titanMemory";

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

export function resolveOracleTokenQuery(text: string, pool: Token[]): Token | null {
  const cleaned = text
    .replace(/^(search|find|scan|check|look up|lookup|what about|tell me about|analyze|analyse)\s+/i, "")
    .replace(/\?/g, "")
    .trim();

  const symbolMatch = cleaned.match(/\b([A-Za-z]{2,12})\b/);
  const query = symbolMatch?.[1] ?? cleaned;
  const hits = searchOracleTokens(query, pool);
  return hits[0] ?? null;
}

export function buildTokenIntelBrief(token: Token): string {
  const lines = [
    `${token.symbol} (${token.name}) · ${synexusRiskBandLabel(token.guardianRisk)} band`,
    `Price ${formatUsd(token.priceUsd)} · 24h ${formatPct(token.change24hPct)}`,
    `Liquidity ${formatUsd(token.liquidityUsd)} · Volume 24h ${formatUsd(token.volume24hUsd)}`,
  ];

  if (token.riskScore != null) lines.push(`Risk score ${token.riskScore}/100 · confidence ${token.confidence ?? "—"}%`);
  if (token.topWalletPct != null) lines.push(`Top wallet ${token.topWalletPct}% · age ${token.tokenAgeHours ?? "?"}h`);
  if (token.riskReasons?.length) lines.push(`Flags: ${token.riskReasons.slice(0, 3).join("; ")}`);
  lines.push(token.guardianMessage);

  return lines.join("\n");
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
    case "titan":
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
      titan: "Hold whale lane — report any top-wallet shift above 3 points.",
      cipher: "Hold pattern fusion — escalate when two lanes agree on one symbol.",
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
    case "titan":
      return {
        lane,
        targetSymbol: sym,
        order: `Shadow ${sym} wallets — top holder ${token.topWalletPct ?? "?"}%, alert Oracle on concentration spikes.`,
      };
    case "cipher":
      return {
        lane,
        targetSymbol: sym,
        order: `Fuse ${sym} signals — cross-check risk, flow, and whales; report fused confidence to Oracle.`,
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
      report: "All quiet — standing by for Oracle's next order.",
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
          ? `Report to Oracle: ${sym} passed contract/liquidity lane — no rug signals in ${baseLatency}ms.`
          : `Report to Oracle: ${sym} ${synexusRiskBandLabel(token.guardianRisk)} — ${token.riskReasons?.[0] ?? "risk elevated"}.`;
      break;
    case "pulse":
      report =
        Math.abs(token.change24hPct) >= 10
          ? `Report to Oracle: ${sym} momentum real at ${formatPct(token.change24hPct)} — volume supports the move.`
          : `Report to Oracle: ${sym} move muted (${formatPct(token.change24hPct)}) — likely noise, not a chase.`;
      break;
    case "titan":
      report =
        (token.topWalletPct ?? 0) >= 22
          ? `Report to Oracle: ${sym} whale control ${token.topWalletPct}% — exit risk elevated.`
          : `Report to Oracle: ${sym} wallets dispersed — no whale squeeze detected.`;
      break;
    case "cipher":
      report = `Report to Oracle: ${sym} pattern read fused — score ${token.riskScore ?? "?"} with ${synexusRiskBandLabel(token.guardianRisk)} alignment. Directive acknowledged.`;
      break;
    default:
      report = `Report to Oracle: ${sym} scanned.`;
  }

  return { lane, report, latencyMs: baseLatency, precision };
}

export function buildAllOracleDirectives(tokens: Token[]): Record<SentinelLaneId, OracleSentinelDirective> {
  const lanes: SentinelLaneId[] = ["aegis", "pulse", "titan", "cipher"];
  const out = {} as Record<SentinelLaneId, OracleSentinelDirective>;
  for (const lane of lanes) {
    out[lane] = buildOracleSentinelDirective(lane, pickFocus(tokens, lane), tokens.length);
  }
  return out;
}

export function answerCryptoConcept(question: string, commanderName = DEFAULT_TITAN_BOT_NAME): string | null {
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
    return "Market cap is price × supply — FDV includes locked tokens. Synexus uses both with volume and liquidity so your commander doesn't chase inflated numbers.";
  }
  if (/solana|sol\b/.test(q) && /what|explain|how/.test(q)) {
    return "Solana is the chain Synexus scans first — fast blocks, meme velocity, and rug risk. Sentinels watch SPL tokens, pools, and wallet flow in real time.";
  }
  if (/sentinel|aegis|pulse|leviathan|cipher/.test(q) && /what|who|do/.test(q)) {
    return `Aegis guards security & privacy (scams, rugs, accounts), Pulse reads momentum, Leviathan shadows whales, Cipher fuses weak signals. ${commanderName} commands each lane and reads their reports.`;
  }
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
      return appendTitanDecisionFooter(
        `Found ${token.symbol} in ${tokens.length} tracked pairs:\n${buildTokenIntelBrief(token)}\n\nSentinels are on ${token.symbol} — Pulse has live orders.`,
      );
    }
    const partial = searchOracleTokens(text.replace(/[^\w\s]/g, " "), tokens);
    if (partial.length) {
      return `Matches: ${partial.slice(0, 5).map((t) => t.symbol).join(", ")}. Name one for a full sweep.`;
    }
    return `No match in the live feed, ${name}. Try a symbol — e.g. BONK, SOL, SYN.`;
  }

  if (/sentinel|aegis|pulse|leviathan|cipher/.test(lower) && /status|report|doing|orders?/.test(lower)) {
    const dirs = buildAllOracleDirectives(tokens);
    return [
      `Sentinel status — ${titanBotName}:`,
      `Aegis → ${dirs.aegis.order}`,
      `Pulse → ${dirs.pulse.order}`,
      `Leviathan → ${dirs.titan.order}`,
      `Cipher → ${dirs.cipher.order}`,
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
