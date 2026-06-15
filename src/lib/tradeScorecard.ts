import type { Token } from "../data/tokens";

export type RugPullLevel = "clear" | "watch" | "elevated";

export type TradeScorecard = {
  riskScore: number;
  whaleActivity: number;
  momentumScore: number;
  liquidityHealth: number;
  rugPullWarning: RugPullLevel;
  rugPullLabel: string;
  overallGrade: "A" | "B" | "C" | "D" | "F";
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function gradeFromScores(risk: number, liquidity: number, rug: RugPullLevel): TradeScorecard["overallGrade"] {
  if (rug === "elevated" || risk >= 70) return "F";
  if (rug === "watch" || risk >= 55) return "D";
  if (risk >= 40 || liquidity < 45) return "C";
  if (risk >= 25 || liquidity < 65) return "B";
  return "A";
}

function rugPullAssessment(token: Token): { level: RugPullLevel; label: string } {
  const reasons = token.riskReasons ?? [];
  const flags = [
    token.guardianRisk === "DANGER",
    token.sharpPumpThenDump,
    token.highVolumeLowLiquidity,
    token.riskyMintOrFreezeAuthorityActive,
    token.repeatedScamCategoryReports,
    (token.liquidityUsd ?? 0) < 25_000,
    (token.topWalletPct ?? 0) > 35,
  ].filter(Boolean).length;

  if (flags >= 3 || token.guardianRisk === "DANGER") {
    return { level: "elevated", label: "Elevated rug signals" };
  }
  if (flags >= 1 || token.guardianRisk === "WARNING") {
    const top = reasons[0];
    return { level: "watch", label: top ? top.slice(0, 48) : "Some rug-risk flags" };
  }
  return { level: "clear", label: "No major rug flags" };
}

/** Higher whale score = more concentration (riskier). */
function whaleActivityScore(token: Token): number {
  const top = token.topWalletPct ?? 12;
  const top5 = token.top5WalletsPct ?? top * 2;
  return clamp(top * 2.2 + top5 * 0.35);
}

/** Momentum 0–100: extreme moves score higher (volatility/opportunity). */
function momentumScore(token: Token): number {
  const h1 = Math.abs(token.priceMove1hPct ?? 0);
  const d1 = Math.abs(token.change24hPct);
  return clamp(h1 * 4 + d1 * 1.8);
}

function liquidityHealthScore(token: Token): number {
  const liq = token.liquidityUsd ?? 0;
  const vol = token.volume24hUsd ?? 1;
  const ratio = liq / Math.max(vol, 1);
  let score = 35;
  if (liq >= 500_000) score += 35;
  else if (liq >= 100_000) score += 22;
  else if (liq >= 25_000) score += 10;
  if (ratio >= 0.5) score += 20;
  else if (ratio >= 0.15) score += 10;
  if (token.highVolumeLowLiquidity) score -= 25;
  return clamp(score);
}

export function buildTradeScorecard(token: Token): TradeScorecard {
  const riskScore = token.riskScore ?? 50;
  const rug = rugPullAssessment(token);
  const liquidityHealth = liquidityHealthScore(token);

  return {
    riskScore,
    whaleActivity: whaleActivityScore(token),
    momentumScore: momentumScore(token),
    liquidityHealth,
    rugPullWarning: rug.level,
    rugPullLabel: rug.label,
    overallGrade: gradeFromScores(riskScore, liquidityHealth, rug.level),
  };
}

export function scorecardTone(value: number, invert = false): "good" | "mid" | "bad" {
  const v = invert ? 100 - value : value;
  if (v >= 65) return "good";
  if (v >= 40) return "mid";
  return "bad";
}

export function rugTone(level: RugPullLevel): "good" | "mid" | "bad" {
  if (level === "clear") return "good";
  if (level === "watch") return "mid";
  return "bad";
}
