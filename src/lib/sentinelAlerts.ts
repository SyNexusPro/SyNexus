import type { Token } from "../data/tokens";
import { synexusRiskBandLabel } from "../data/tokens";

export type SentinelAlertItem = {
  id: string;
  symbol: string;
  name: string;
  severity: "SAFE" | "WARNING" | "DANGER";
  lane: "Aegis" | "Pulse" | "Titan" | "Cipher";
  title: string;
  message: string;
  tokenId?: string;
  timestamp: number;
};

function laneForToken(token: Token): SentinelAlertItem["lane"] {
  if (token.guardianRisk === "DANGER" || (token.riskScore ?? 0) >= 55) return "Aegis";
  if (Math.abs(token.change24hPct) >= 12) return "Pulse";
  if ((token.topWalletPct ?? 0) >= 22) return "Titan";
  return "Cipher";
}

function alertTitle(token: Token): string {
  if (token.guardianRisk === "DANGER") return "Danger — exit liquidity risk";
  if (token.guardianRisk === "WARNING") return "Warning — Sentinel flagged";
  if (Math.abs(token.change24hPct) >= 15) return "Momentum spike";
  if ((token.topWalletPct ?? 0) >= 25) return "Whale concentration";
  return "Sentinel scan";
}

export function buildSentinelAlertsFromTokens(tokens: Token[]): SentinelAlertItem[] {
  const now = Date.now();
  return tokens
    .filter((t) => t.guardianRisk !== "SAFE" || Math.abs(t.change24hPct) >= 10)
    .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
    .slice(0, 12)
    .map((token, i) => ({
      id: `alert-${token.id}-${i}`,
      symbol: token.symbol,
      name: token.name,
      severity: token.guardianRisk,
      lane: laneForToken(token),
      title: alertTitle(token),
      message:
        token.riskReasons?.[0] ??
        `${synexusRiskBandLabel(token.guardianRisk)} · ${token.guardianMessage}`,
      tokenId: token.id,
      timestamp: now - i * 60_000,
    }));
}

export function mergeSentinelAlerts(
  fromTokens: SentinelAlertItem[],
  extra: { symbol: string; severity: "WARNING" | "DANGER"; note: string }[],
): SentinelAlertItem[] {
  const mapped = extra.map((e, i) => ({
    id: `pulse-${e.symbol}-${i}`,
    symbol: e.symbol,
    name: e.symbol,
    severity: e.severity,
    lane: "Cipher" as const,
    title: "Pulse watchlist hit",
    message: e.note,
    timestamp: Date.now() - i * 30_000,
  }));
  const combined = [...fromTokens, ...mapped];
  const seen = new Set<string>();
  return combined.filter((a) => {
    const key = a.symbol.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
