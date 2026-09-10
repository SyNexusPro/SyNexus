import type { Token } from "../data/tokens";
import { synexusRiskBandLabel } from "../data/tokens";
import { analyzeShouldIBuy, type BuyVerdict } from "./shouldIBuy";
import { evaluateTokenDiscovery, type TitanDiscoveryEvaluation } from "./titanDiscovery";
import { buildTradeScorecard, type TradeScorecard } from "./tradeScorecard";

export type SwapSafetyReport = {
  token: Token;
  verdict: BuyVerdict;
  headline: string;
  explanation: string;
  card: TradeScorecard;
  discovery: TitanDiscoveryEvaluation;
  riskLabel: string;
  guardianMessage: string;
  swapAllowed: boolean;
  requiresRiskAck: boolean;
  blockReason: string | null;
};

const HIGH_IMPACT_BLOCK = 15;
const HIGH_IMPACT_ACK = 8;

export function assessSwapToken(token: Token): SwapSafetyReport {
  const buy = analyzeShouldIBuy(token);
  const card = buildTradeScorecard(token);
  const discovery = evaluateTokenDiscovery(token);
  const blocked = buy.verdict === "AVOID" || token.guardianRisk === "DANGER";

  return {
    token,
    verdict: buy.verdict,
    headline: buy.headline,
    explanation: buy.explanation,
    card,
    discovery,
    riskLabel: synexusRiskBandLabel(token.guardianRisk),
    guardianMessage: token.guardianMessage,
    swapAllowed: !blocked,
    requiresRiskAck: buy.verdict === "HIGH_RISK",
    blockReason: blocked
      ? `${token.symbol} failed Titan safety (${buy.headline}). Swap is locked.`
      : null,
  };
}

export function priceImpactGate(priceImpactPct: number): {
  blocked: boolean;
  requiresAck: boolean;
  label: string;
} {
  const abs = Math.abs(priceImpactPct);
  if (abs >= HIGH_IMPACT_BLOCK) {
    return {
      blocked: true,
      requiresAck: false,
      label: `Price impact ${abs.toFixed(2)}% is too high. Swap is locked.`,
    };
  }
  if (abs >= HIGH_IMPACT_ACK) {
    return {
      blocked: false,
      requiresAck: true,
      label: `Price impact ${abs.toFixed(2)}% is high. Confirm you accept slippage.`,
    };
  }
  return {
    blocked: false,
    requiresAck: false,
    label: `${abs.toFixed(2)}%`,
  };
}
