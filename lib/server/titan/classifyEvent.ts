export type TitanSeverity = "low" | "normal" | "high" | "critical";

export type MarketEventSignal = {
  type?: string;
  priceChangePercent?: number;
  transactionValueUsd?: number;
  securityThreat?: boolean;
  exploitDetected?: boolean;
  exchangeHack?: boolean;
  whaleMovementUsd?: number;
  discoveryScore?: number;
  riskScore?: number;
  momentumScore?: number;
};

/**
 * Severity gate so Titan does not spam Pro for noise (e.g. BTC ±0.4%).
 * Only high/critical should trigger instant premium push fanout.
 * High-risk discoveries remain reportable (not suppressed).
 */
export function classifyEvent(event: MarketEventSignal): TitanSeverity {
  if (event.exploitDetected || event.exchangeHack) {
    return "critical";
  }

  const discovery = event.discoveryScore ?? 0;
  const risk = event.riskScore ?? 0;
  const momentum = event.momentumScore ?? 0;

  if (event.type === "LAUNCH_WATCH") {
    return "normal";
  }
  if (risk >= 85 && momentum >= 70) return "critical";
  if (discovery >= 70 || (risk >= 65 && discovery >= 55) || (discovery >= 60 && momentum >= 65)) {
    return "high";
  }
  if (discovery >= 45 || momentum >= 55) return "normal";

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
