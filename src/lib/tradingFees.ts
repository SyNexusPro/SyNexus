import {
  TRADING_FEE_BPS,
  TRADING_FEE_REVENUE_ALLOCATION,
  type SynexusPlan,
  type TradingFeeAllocationId,
} from "../config/tradingFees";
import { bpsToLabel } from "../config/ecosystem";

export type { SynexusPlan, TradingFeeAllocationId };

export const PLAN_STORAGE_KEY = "hivemind_paid_plan";

export function normalizeSynexusPlan(plan: string | null | undefined): SynexusPlan {
  return plan === "PRO" ? "PRO" : "FREE";
}

export function getTradingFeeBps(plan: SynexusPlan): number {
  return TRADING_FEE_BPS[plan];
}

export function formatTradingFeeRate(plan: SynexusPlan): string {
  return bpsToLabel(getTradingFeeBps(plan));
}

export function calculateTradeFeeUsd(notionalUsd: number, plan: SynexusPlan): number {
  if (!Number.isFinite(notionalUsd) || notionalUsd <= 0) return 0;
  return (notionalUsd * getTradingFeeBps(plan)) / 10_000;
}

export type TradingFeeAllocationSlice = {
  id: TradingFeeAllocationId;
  label: string;
  pct: number;
  amountUsd: number;
};

export function allocateTradingFeeRevenue(feeUsd: number): TradingFeeAllocationSlice[] {
  const total = Number.isFinite(feeUsd) && feeUsd > 0 ? feeUsd : 0;
  return TRADING_FEE_REVENUE_ALLOCATION.map((row) => ({
    id: row.id,
    label: row.label,
    pct: row.pct,
    amountUsd: (total * row.pct) / 100,
  }));
}

export function formatFeeUsd(amountUsd: number): string {
  if (amountUsd >= 1) {
    return amountUsd.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (amountUsd >= 0.0001) {
    return amountUsd.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  }
  return amountUsd.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 6,
    maximumFractionDigits: 8,
  });
}
