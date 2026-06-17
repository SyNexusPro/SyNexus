import type { Token } from "../data/tokens";
import { buildTradeScorecard } from "./tradeScorecard";

export type BuyVerdict = "AVOID" | "HIGH_RISK" | "WATCH" | "OK";

export type ShouldIBuyResult = {
  verdict: BuyVerdict;
  headline: string;
  explanation: string;
  token: Token;
};

const VERDICT_HEADLINE: Record<BuyVerdict, string> = {
  AVOID: "Avoid",
  HIGH_RISK: "High risk",
  WATCH: "Watch",
  OK: "Caution — size small",
};

export function analyzeShouldIBuy(token: Token): ShouldIBuyResult {
  const card = buildTradeScorecard(token);
  let verdict: BuyVerdict = "WATCH";

  if (token.guardianRisk === "DANGER" || card.rugPullWarning === "elevated" || card.riskScore >= 65) {
    verdict = "AVOID";
  } else if (token.guardianRisk === "WARNING" || card.riskScore >= 45 || card.whaleActivity >= 55) {
    verdict = "HIGH_RISK";
  } else if (card.riskScore >= 28 || card.rugPullWarning === "watch" || card.liquidityHealth < 50) {
    verdict = "WATCH";
  } else {
    verdict = "OK";
  }

  const explanation = buildPlainEnglish(token, card, verdict);

  return {
    verdict,
    headline: VERDICT_HEADLINE[verdict],
    explanation,
    token,
  };
}

function buildPlainEnglish(
  token: Token,
  card: ReturnType<typeof buildTradeScorecard>,
  verdict: BuyVerdict,
): string {
  const parts: string[] = [];

  if (verdict === "AVOID") {
    parts.push(
      `${token.symbol} is flashing serious Sentinel warnings. Risk score is ${card.riskScore}/100 with ${card.rugPullLabel.toLowerCase()}.`,
    );
  } else if (verdict === "HIGH_RISK") {
    parts.push(
      `${token.symbol} is tradable only with extreme caution. Sentinels see ${token.guardianRisk.toLowerCase()} conditions and whale concentration is elevated.`,
    );
  } else if (verdict === "WATCH") {
    parts.push(
      `${token.symbol} is not clean enough to ape. Momentum and liquidity look mixed — wait for a clearer Sentinel read.`,
    );
  } else {
    parts.push(
      `${token.symbol} passes a basic Sentinel screen, but no memecoin is safe. Liquidity health is ${card.liquidityHealth}/100 — still verify the mint and size small.`,
    );
  }

  if (card.whaleActivity >= 50) {
    parts.push(`Whale activity is high (top wallets control a large share).`);
  } else if (card.momentumScore >= 60) {
    parts.push(`Momentum is running hot (${token.change24hPct >= 0 ? "+" : ""}${token.change24hPct.toFixed(1)}% 24h).`);
  }

  if (card.liquidityHealth < 45) {
    parts.push(`Liquidity is thin for this volume — exits may slip.`);
  }

  parts.push("Not financial advice. You sign every trade in your wallet.");

  return parts.join(" ");
}

export function verdictTone(verdict: BuyVerdict): "bad" | "mid" | "warn" | "good" {
  switch (verdict) {
    case "AVOID":
      return "bad";
    case "HIGH_RISK":
      return "warn";
    case "WATCH":
      return "mid";
    default:
      return "good";
  }
}

/** Plain labels for Easy mode — no jargon. */
export function verdictBeginnerMeta(verdict: BuyVerdict): {
  icon: string;
  label: string;
  hint: string;
} {
  switch (verdict) {
    case "AVOID":
      return { icon: "⛔", label: "Don't buy", hint: "Too many red flags right now." };
    case "HIGH_RISK":
      return { icon: "⚠️", label: "Very risky", hint: "Only trade if you accept big loss." };
    case "WATCH":
      return { icon: "👀", label: "Wait & watch", hint: "Not clear enough to ape yet." };
    default:
      return { icon: "✓", label: "Looks okay", hint: "Still verify the mint — start small." };
  }
}
