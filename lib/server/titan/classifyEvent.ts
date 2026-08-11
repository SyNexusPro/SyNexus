export type TitanSeverity = "low" | "normal" | "high" | "critical";

export type MarketEventSignal = {
  type?: string;
  priceChangePercent?: number;
  transactionValueUsd?: number;
  securityThreat?: boolean;
  exploitDetected?: boolean;
  exchangeHack?: boolean;
  whaleMovementUsd?: number;
};

/**
 * Severity gate so Titan does not spam Pro for noise (e.g. BTC ±0.4%).
 * Only high/critical should trigger instant premium push fanout.
 */
export function classifyEvent(event: MarketEventSignal): TitanSeverity {
  if (event.exploitDetected || event.exchangeHack) {
    return "critical";
  }

  if (event.securityThreat || Math.abs(event.priceChangePercent || 0) >= 15) {
    return "high";
  }

  if ((event.whaleMovementUsd || 0) >= 5_000_000 || (event.transactionValueUsd || 0) >= 5_000_000) {
    return "high";
  }

  if ((event.whaleMovementUsd || 0) >= 50_000 || (event.transactionValueUsd || 0) >= 50_000) {
    return "high";
  }

  if (Math.abs(event.priceChangePercent || 0) >= 5) {
    return "normal";
  }

  return "low";
}

export function shouldSendInstantPremium(severity: TitanSeverity): boolean {
  return severity === "critical" || severity === "high";
}
