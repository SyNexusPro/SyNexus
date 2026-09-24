export type TapeRisk = "SAFE" | "WARNING" | "DANGER";

export type TapeToken = {
  id: string;
  symbol: string;
  name: string;
  mint: string;
  priceUsd: number;
  change24hPct: number;
  marketCapUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  safetyScore: number;
  risk: TapeRisk;
  createdAt: number;
};

export type LiveEventName =
  | "SCAN_COMPLETE"
  | "WATCHLIST_ALERT"
  | "WALLET_CHANGED"
  | "TRADE_STATUS"
  | "HERA_RESPONSE"
  | "TOKEN_ACTIVITY";

export type DashboardSnapshot = {
  updatedAt: number;
  source: "sample" | "cache" | "live";
  connected: boolean;
  walletAddress: string | null;
  walletSol: number | null;
  tokens: TapeToken[];
  alerts: string[];
};

export type RealtimeMessage =
  | { type: "snapshot"; dashboard: DashboardSnapshot }
  | { type: "patch"; tokens: TapeToken[]; updatedAt: number }
  | { type: "event"; name: LiveEventName; detail: string; mint?: string };
