import type { Token } from "../data/tokens";
import { buildTradeScorecard } from "./tradeScorecard";
import { heraDataAsOfLine } from "./hera/formatLiveStamp";

export type TitanConfidence = "low" | "medium" | "high";

export type TitanDiscoveryEvaluation = {
  symbol: string;
  name: string;
  chain: string;
  contractAddress: string | null;
  discoveryScore: number;
  riskScore: number;
  momentumScore: number;
  confidence: TitanConfidence;
  /** Confirmed on-chain / market facts */
  facts: string[];
  /** Interpretive reads — not proven */
  speculation: string[];
  /** Why Titan thinks this is moving */
  whyMoving: string[];
  /** Unusual combinations that raised priority */
  unusualSignals: string[];
  /** High-risk tokens are still reportable */
  highRiskReportable: boolean;
  /** Whether this is worth surfacing (anti-spam) */
  shouldReport: boolean;
  summary: string;
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function confidenceFromSignals(known: number, total: number, guardianConfidence?: number): TitanConfidence {
  const coverage = total <= 0 ? 0 : known / total;
  const blended = guardianConfidence != null ? coverage * 0.55 + (guardianConfidence / 100) * 0.45 : coverage;
  if (blended >= 0.72) return "high";
  if (blended >= 0.42) return "medium";
  return "low";
}

/**
 * Titan discovery evaluation — multi-signal read for emerging / moving assets.
 * Hype alone never raises discovery quality; high-risk finds stay reportable.
 */
export function evaluateTokenDiscovery(token: Token, opts?: { chain?: string }): TitanDiscoveryEvaluation {
  const card = buildTradeScorecard(token);
  const chain = opts?.chain ?? "solana";
  const liq = token.liquidityUsd ?? 0;
  const vol = token.volume24hUsd ?? 0;
  const ageH = token.tokenAgeHours;
  const top = token.topWalletPct ?? 0;
  const move1h = token.priceMove1hPct ?? 0;
  const move24h = token.change24hPct;
  const risk = token.riskScore ?? card.riskScore;

  const facts: string[] = [];
  const speculation: string[] = [];
  const whyMoving: string[] = [];
  const unusualSignals: string[] = [];
  let knownSignals = 0;
  const totalSignals = 14;

  facts.push(`Token ${token.name} (${token.symbol}) on ${chain}`);
  if (token.mintAddress) {
    facts.push(`Contract ${token.mintAddress}`);
    knownSignals++;
  }
  if (ageH != null) {
    facts.push(`Token age ~${ageH < 24 ? `${ageH}h` : `${(ageH / 24).toFixed(1)}d`}`);
    knownSignals++;
  }
  if (token.liquidityUsd != null) {
    facts.push(`Liquidity $${Math.round(liq).toLocaleString("en-US")}`);
    knownSignals++;
  }
  if (token.volume24hUsd != null) {
    facts.push(`24h volume $${Math.round(vol).toLocaleString("en-US")}`);
    knownSignals++;
  }
  if (token.topWalletPct != null) {
    facts.push(`Top wallet concentration ~${top.toFixed(1)}%`);
    knownSignals++;
  }
  if (token.priceMove1hPct != null) {
    facts.push(`1h price change ${move1h >= 0 ? "+" : ""}${move1h.toFixed(2)}%`);
    knownSignals++;
  }
  facts.push(`24h price change ${move24h >= 0 ? "+" : ""}${move24h.toFixed(2)}%`);
  knownSignals++;

  if (token.riskyMintOrFreezeAuthorityActive) {
    facts.push("Mint/freeze authority appears active");
    knownSignals++;
  }
  if (token.guardianRisk) {
    facts.push(`Guardian band ${token.guardianRisk}`);
    knownSignals++;
  }
  if (token.highVolumeLowLiquidity) {
    facts.push("Volume elevated vs thin liquidity");
    knownSignals++;
  }
  if (token.sharpPumpThenDump) {
    facts.push("Sharp pump-then-dump pattern flagged");
    knownSignals++;
  }
  if (token.suspiciousVolumeWithFewHolders) {
    facts.push("Suspicious volume with few holders");
    knownSignals++;
  }
  if (token.riskReasons?.length) {
    facts.push(`Security/risk flags: ${token.riskReasons.slice(0, 3).join("; ")}`);
    knownSignals++;
  }

  // Discovery: novelty + breakout activity + listings/liquidity growth proxies
  let discovery = 18;
  if (ageH != null && ageH <= 24) discovery += 22;
  else if (ageH != null && ageH <= 72) discovery += 14;
  else if (ageH != null && ageH <= 168) discovery += 8;

  if (liq >= 25_000 && liq < 500_000) discovery += 12;
  else if (liq >= 500_000) discovery += 8;
  if (vol >= 50_000) discovery += 10;
  if (vol >= 250_000) discovery += 8;
  if (Math.abs(move1h) >= 8) discovery += 10;
  if (Math.abs(move24h) >= 25) discovery += 10;
  if (liq > 0 && vol / Math.max(liq, 1) >= 2) discovery += 8;

  // Organic-looking structure modestly helps discovery; hype without structure does not
  if (top > 0 && top < 18 && liq >= 50_000) discovery += 6;
  if (token.fakeBrandingImpersonation || token.similarTickerToKnownToken) discovery -= 12;
  if (token.missingSocialsOrWebsite && (ageH == null || ageH < 72)) discovery -= 4;

  // Momentum axis (velocity / imbalance proxy)
  let momentum = card.momentumScore;
  if (move24h > 0 && move1h > 0) momentum = clamp(momentum + 6);
  if (token.highVolumeLowLiquidity) momentum = clamp(momentum + 4);

  // Risk axis — keep high-risk visible, never suppress
  let riskScore = risk;
  if (card.rugPullWarning === "elevated") riskScore = clamp(Math.max(riskScore, 78));
  if (card.rugPullWarning === "watch") riskScore = clamp(Math.max(riskScore, 55));
  if (token.guardianRisk === "DANGER") riskScore = clamp(Math.max(riskScore, 80));

  // Why moving
  if (Math.abs(move1h) >= 5 || Math.abs(move24h) >= 12) {
    whyMoving.push(
      `Price velocity is elevated (${move1h ? `1h ${move1h.toFixed(1)}%` : "n/a"}, 24h ${move24h.toFixed(1)}%).`,
    );
  }
  if (vol >= 100_000 && liq > 0) {
    whyMoving.push(`DEX volume is material relative to book (vol/liq ${(vol / Math.max(liq, 1)).toFixed(2)}x).`);
  }
  if (top >= 25) {
    whyMoving.push("Holder concentration suggests whale-driven prints can dominate price.");
  }
  if (ageH != null && ageH <= 48 && (Math.abs(move24h) >= 20 || vol >= 80_000)) {
    whyMoving.push("New launch window with active trading — classic discovery tape.");
  }
  if (!whyMoving.length) {
    whyMoving.push("No single dominant catalyst in current metrics — treat move as unexplained until confirmed.");
  }

  // Speculation (explicitly separated)
  if (Math.abs(move24h) >= 40 && liq < 80_000) {
    speculation.push("Move may be thin-book amplification rather than broad demand.");
  }
  if (top >= 30 && move24h > 15) {
    speculation.push("Accumulation narrative is unconfirmed — could be wash or coordinated wallets.");
  }
  if (token.missingSocialsOrWebsite) {
    speculation.push("Social/news momentum cannot be verified from available fields.");
  }
  if (card.momentumScore >= 70 && riskScore < 40) {
    speculation.push("Momentum looks constructive if liquidity holds — still not proof of quality.");
  }
  speculation.push("Hype or ticker chatter alone is never treated as quality evidence.");

  // Unusual combinations Titan prioritizes
  if (liq >= 40_000 && vol >= 120_000 && Math.abs(move24h) >= 15) {
    unusualSignals.push("Rapid liquidity + volume + price velocity");
  }
  if (ageH != null && ageH <= 72 && vol >= 80_000) {
    unusualSignals.push("New token with accelerating DEX activity");
  }
  if (top >= 28 && move24h > 10 && vol >= 50_000) {
    unusualSignals.push("Large-wallet concentration with rising tape");
  }
  if (token.riskyMintOrFreezeAuthorityActive && Math.abs(move24h) >= 10) {
    unusualSignals.push("Active mint/freeze authority during price move");
  }
  if (token.guardianRisk === "DANGER" && (Math.abs(move24h) >= 20 || vol >= 100_000)) {
    unusualSignals.push("High security risk with material market activity (report, do not suppress)");
  }

  discovery = clamp(discovery + unusualSignals.length * 4);

  const confidence = confidenceFromSignals(knownSignals, totalSignals, token.confidence);
  const highRiskReportable = riskScore >= 65 || token.guardianRisk === "DANGER" || card.rugPullWarning === "elevated";

  // Anti-spam: require unusual combo OR meaningful discovery/momentum; never drop high-risk movers
  const shouldReport =
    unusualSignals.length >= 1 ||
    discovery >= 55 ||
    (momentum >= 62 && discovery >= 40) ||
    (highRiskReportable && (discovery >= 45 || momentum >= 55 || vol >= 100_000));

  const summary = shouldReport
    ? highRiskReportable
      ? `${token.symbol}: discovery ${discovery}/100 · HIGH RISK ${riskScore}/100 · momentum ${momentum}/100 (${confidence} confidence). Reportable — not an endorsement.`
      : `${token.symbol}: discovery ${discovery}/100 · risk ${riskScore}/100 · momentum ${momentum}/100 (${confidence} confidence).`
    : `${token.symbol}: activity below Titan discovery threshold (discovery ${discovery}, momentum ${momentum}).`;

  return {
    symbol: token.symbol,
    name: token.name,
    chain,
    contractAddress: token.mintAddress ?? null,
    discoveryScore: discovery,
    riskScore,
    momentumScore: clamp(momentum),
    confidence,
    facts,
    speculation,
    whyMoving,
    unusualSignals,
    highRiskReportable,
    shouldReport,
    summary,
  };
}

export function formatDiscoveryBrief(evalResult: TitanDiscoveryEvaluation): string {
  const lines = [
    `TITAN DISCOVERY · ${evalResult.symbol} (${evalResult.name}) · ${evalResult.chain}`,
    `DISCOVERY SCORE: ${evalResult.discoveryScore}/100`,
    `RISK SCORE: ${evalResult.riskScore}/100${evalResult.highRiskReportable ? " · HIGH RISK (still reportable)" : ""}`,
    `MOMENTUM SCORE: ${evalResult.momentumScore}/100`,
    `CONFIDENCE: ${evalResult.confidence}`,
    "",
    "WHY IT MAY BE MOVING:",
    ...evalResult.whyMoving.map((w) => `- ${w}`),
    "",
    "CONFIRMED FACTS:",
    ...evalResult.facts.slice(0, 8).map((f) => `- ${f}`),
    "",
    "SPECULATION (not confirmed):",
    ...evalResult.speculation.slice(0, 5).map((s) => `- ${s}`),
  ];
  if (evalResult.unusualSignals.length) {
    lines.push("", "UNUSUAL COMBINATIONS:", ...evalResult.unusualSignals.map((u) => `- ${u}`));
  }
  lines.push("", evalResult.summary, "", heraDataAsOfLine(Date.now(), "discovery scan"));
  return lines.join("\n");
}

/** Rank pool for discovery radar (reportable first, then by discovery×momentum). */
export function rankDiscoveryCandidates(tokens: Token[], limit = 8): TitanDiscoveryEvaluation[] {
  return tokens
    .map((t) => evaluateTokenDiscovery(t))
    .filter((e) => e.shouldReport)
    .sort((a, b) => {
      const score = (e: TitanDiscoveryEvaluation) =>
        e.discoveryScore * 1.1 + e.momentumScore - (e.highRiskReportable ? 0 : 0) + e.unusualSignals.length * 5;
      return score(b) - score(a);
    })
    .slice(0, limit);
}
