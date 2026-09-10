/**
 * Server-side Titan discovery evaluation (DexScreener / cron safe).
 * Mirrors the product axes used by src/lib/titanDiscovery.ts.
 */

export type TitanConfidence = "low" | "medium" | "high";

export type DiscoveryAssetInput = {
  symbol: string;
  name: string;
  chain?: string;
  contractAddress?: string | null;
  priceUsd?: number | null;
  change24hPct?: number | null;
  priceMove1hPct?: number | null;
  liquidityUsd?: number | null;
  volume24hUsd?: number | null;
  /** Hours since launch when known */
  tokenAgeHours?: number | null;
  topWalletPct?: number | null;
  txCount24h?: number | null;
  pairCreatedAtMs?: number | null;
  boostAmount?: number | null;
  hasSocials?: boolean | null;
  mintAuthorityActive?: boolean | null;
  freezeAuthorityActive?: boolean | null;
  securityWarnings?: string[];
};

export type DiscoveryEvaluation = {
  symbol: string;
  name: string;
  chain: string;
  contractAddress: string | null;
  discoveryScore: number;
  riskScore: number;
  momentumScore: number;
  confidence: TitanConfidence;
  facts: string[];
  speculation: string[];
  whyMoving: string[];
  unusualSignals: string[];
  highRiskReportable: boolean;
  shouldReport: boolean;
  summary: string;
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function ageHoursFromPair(createdAtMs?: number | null): number | null {
  if (createdAtMs == null || !Number.isFinite(createdAtMs)) return null;
  return Math.max(0, (Date.now() - createdAtMs) / 3_600_000);
}

export function evaluateDiscovery(input: DiscoveryAssetInput): DiscoveryEvaluation {
  const chain = (input.chain || "solana").toLowerCase();
  const symbol = (input.symbol || "UNKNOWN").toUpperCase();
  const name = input.name || symbol;
  const liq = Number(input.liquidityUsd) || 0;
  const vol = Number(input.volume24hUsd) || 0;
  const move24h = Number(input.change24hPct) || 0;
  const move1h = Number(input.priceMove1hPct) || 0;
  const ageH = input.tokenAgeHours ?? ageHoursFromPair(input.pairCreatedAtMs);
  const top = Number(input.topWalletPct) || 0;
  const tx = Number(input.txCount24h) || 0;
  const warnings = input.securityWarnings ?? [];

  const facts: string[] = [];
  const speculation: string[] = [];
  const whyMoving: string[] = [];
  const unusualSignals: string[] = [];
  let known = 0;
  const total = 12;

  facts.push(`${name} (${symbol}) on ${chain}`);
  if (input.contractAddress) {
    facts.push(`Contract ${input.contractAddress}`);
    known++;
  }
  if (ageH != null) {
    facts.push(`Pair/token age ~${ageH < 24 ? `${ageH.toFixed(1)}h` : `${(ageH / 24).toFixed(1)}d`}`);
    known++;
  }
  if (input.liquidityUsd != null) {
    facts.push(`Liquidity $${Math.round(liq).toLocaleString("en-US")}`);
    known++;
  }
  if (input.volume24hUsd != null) {
    facts.push(`24h volume $${Math.round(vol).toLocaleString("en-US")}`);
    known++;
  }
  if (tx > 0) {
    facts.push(`~${tx.toLocaleString("en-US")} swaps/tx in window`);
    known++;
  }
  if (input.priceUsd != null) {
    facts.push(`Last price $${Number(input.priceUsd)}`);
    known++;
  }
  facts.push(`24h change ${move24h >= 0 ? "+" : ""}${move24h.toFixed(2)}%`);
  known++;
  if (input.priceMove1hPct != null) {
    facts.push(`1h change ${move1h >= 0 ? "+" : ""}${move1h.toFixed(2)}%`);
    known++;
  }
  if (input.mintAuthorityActive || input.freezeAuthorityActive) {
    facts.push(
      `Authority risk: mint=${Boolean(input.mintAuthorityActive)} freeze=${Boolean(input.freezeAuthorityActive)}`,
    );
    known++;
  }
  if (warnings.length) {
    facts.push(`Security warnings: ${warnings.slice(0, 3).join("; ")}`);
    known++;
  }
  if (input.hasSocials === true) {
    facts.push("Social/profile metadata present on aggregator");
    known++;
  } else if (input.hasSocials === false) {
    facts.push("No social/profile metadata on aggregator");
    known++;
  }

  let discovery = 16;
  if (ageH != null && ageH <= 24) discovery += 24;
  else if (ageH != null && ageH <= 72) discovery += 16;
  else if (ageH != null && ageH <= 168) discovery += 8;

  if (liq >= 20_000 && liq < 750_000) discovery += 12;
  else if (liq >= 750_000) discovery += 7;
  if (vol >= 40_000) discovery += 10;
  if (vol >= 200_000) discovery += 8;
  if (tx >= 200) discovery += 6;
  if (Math.abs(move1h) >= 8) discovery += 10;
  if (Math.abs(move24h) >= 25) discovery += 10;
  if (liq > 0 && vol / Math.max(liq, 1) >= 2) discovery += 8;
  if ((input.boostAmount || 0) >= 10) discovery += 4; // weak signal — never decisive
  if (input.hasSocials === true && liq >= 50_000) discovery += 4;
  if (input.hasSocials === false && ageH != null && ageH < 48) discovery -= 3;

  let momentum = clamp(Math.abs(move1h) * 4 + Math.abs(move24h) * 1.6 + (tx > 500 ? 8 : 0));
  if (move24h > 0 && move1h > 0) momentum = clamp(momentum + 6);

  let riskScore = 28;
  if (liq > 0 && liq < 25_000) riskScore += 22;
  if (liq > 0 && vol / Math.max(liq, 1) >= 4) riskScore += 14;
  if (top >= 25) riskScore += 16;
  else if (top >= 15) riskScore += 8;
  if (input.mintAuthorityActive || input.freezeAuthorityActive) riskScore += 18;
  if (warnings.length) riskScore += Math.min(24, warnings.length * 8);
  if (ageH != null && ageH < 6 && Math.abs(move24h) >= 40) riskScore += 12;
  if ((input.boostAmount || 0) >= 50 && liq < 40_000) {
    riskScore += 8;
    speculation.push("Paid boost / promo activity on a thin book — treat as marketing, not quality.");
  }
  riskScore = clamp(riskScore);

  if (Math.abs(move1h) >= 5 || Math.abs(move24h) >= 12) {
    whyMoving.push(`Price velocity elevated (1h ${move1h.toFixed(1)}%, 24h ${move24h.toFixed(1)}%).`);
  }
  if (vol >= 80_000 && liq > 0) {
    whyMoving.push(`DEX volume material vs liquidity (vol/liq ${(vol / Math.max(liq, 1)).toFixed(2)}x).`);
  }
  if (tx >= 300) whyMoving.push("Transaction count is elevated for this window.");
  if (ageH != null && ageH <= 48 && vol >= 50_000) {
    whyMoving.push("New launch window with active DEX trading.");
  }
  if (!whyMoving.length) {
    whyMoving.push("No dominant confirmed catalyst in current metrics.");
  }

  speculation.push("Hype alone is never evidence of quality.");
  if (Math.abs(move24h) >= 40 && liq < 80_000) {
    speculation.push("Move may be thin-book amplification rather than organic demand.");
  }
  if (top >= 30) {
    speculation.push("Whale accumulation narrative unconfirmed without wallet-level flow proof.");
  }
  if (input.hasSocials == null) {
    speculation.push("Social/news momentum not fully verified in this pass.");
  }

  if (liq >= 40_000 && vol >= 120_000 && Math.abs(move24h) >= 15) {
    unusualSignals.push("Rapid liquidity + volume + price velocity");
  }
  if (ageH != null && ageH <= 72 && vol >= 80_000) {
    unusualSignals.push("New token with accelerating DEX activity");
  }
  if (top >= 28 && move24h > 10 && vol >= 50_000) {
    unusualSignals.push("Large-wallet concentration with rising tape");
  }
  if ((input.mintAuthorityActive || input.freezeAuthorityActive) && Math.abs(move24h) >= 10) {
    unusualSignals.push("Authority risk during active price move");
  }
  if (riskScore >= 65 && (Math.abs(move24h) >= 20 || vol >= 100_000)) {
    unusualSignals.push("High-risk asset with material market activity (report, do not suppress)");
  }

  discovery = clamp(discovery + unusualSignals.length * 4);
  const coverage = known / total;
  const confidence: TitanConfidence = coverage >= 0.72 ? "high" : coverage >= 0.42 ? "medium" : "low";
  const highRiskReportable = riskScore >= 65 || warnings.length >= 2;

  const shouldReport =
    unusualSignals.length >= 1 ||
    discovery >= 55 ||
    (momentum >= 62 && discovery >= 40) ||
    (highRiskReportable && (discovery >= 45 || momentum >= 55 || vol >= 100_000));

  const summary = shouldReport
    ? highRiskReportable
      ? `${symbol}: discovery ${discovery}/100 · HIGH RISK ${riskScore}/100 · momentum ${momentum}/100 (${confidence}). Reportable — not an endorsement.`
      : `${symbol}: discovery ${discovery}/100 · risk ${riskScore}/100 · momentum ${momentum}/100 (${confidence}).`
    : `${symbol}: below Titan discovery threshold (discovery ${discovery}, momentum ${momentum}).`;

  return {
    symbol,
    name,
    chain,
    contractAddress: input.contractAddress ?? null,
    discoveryScore: discovery,
    riskScore,
    momentumScore: momentum,
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

/** Map discovery evaluation → event severity (high-risk movers still alert). */
export function discoverySeverity(
  evaluation: DiscoveryEvaluation,
): "low" | "normal" | "high" | "critical" {
  if (evaluation.riskScore >= 85 && evaluation.momentumScore >= 70) return "critical";
  if (
    evaluation.discoveryScore >= 70 ||
    (evaluation.highRiskReportable && evaluation.discoveryScore >= 55) ||
    (evaluation.discoveryScore >= 60 && evaluation.momentumScore >= 65)
  ) {
    return "high";
  }
  if (evaluation.discoveryScore >= 45 || evaluation.unusualSignals.length >= 1) return "normal";
  return "low";
}

export function discoveryEventPayload(evaluation: DiscoveryEvaluation) {
  const severity = discoverySeverity(evaluation);
  const riskTag = evaluation.highRiskReportable ? " · HIGH RISK" : "";
  return {
    type: "DISCOVERY_SCORE",
    title: `Titan discovery: ${evaluation.symbol}${riskTag}`,
    summary: [
      evaluation.summary,
      `Why: ${evaluation.whyMoving[0] || "n/a"}`,
      evaluation.unusualSignals.length
        ? `Unusual: ${evaluation.unusualSignals.join("; ")}`
        : null,
    ]
      .filter(Boolean)
      .join(" "),
    symbol: evaluation.symbol,
    tokenAddress: evaluation.contractAddress,
    severity,
    metadata: {
      discoveryScore: evaluation.discoveryScore,
      riskScore: evaluation.riskScore,
      momentumScore: evaluation.momentumScore,
      confidence: evaluation.confidence,
      chain: evaluation.chain,
      facts: evaluation.facts.slice(0, 10),
      speculation: evaluation.speculation.slice(0, 6),
      whyMoving: evaluation.whyMoving,
      unusualSignals: evaluation.unusualSignals,
      highRiskReportable: evaluation.highRiskReportable,
      priceChangePercent: undefined as number | undefined,
      securityThreat: evaluation.highRiskReportable,
    },
  };
}
