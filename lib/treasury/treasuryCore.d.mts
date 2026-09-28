export type LogRevenueInput = {
  source: string;
  amountUsd: number;
  note?: string;
  stripeEventId?: string | null;
  stripeInvoiceId?: string | null;
  stripeCustomerId?: string | null;
  env?: Record<string, string | undefined>;
};

export type LogRevenueResult =
  | { skipped: true; reason: string; entry?: undefined }
  | { skipped: false; reason?: undefined; entry: { id: string; amountUsd: number } & Record<string, unknown> };

export function logRevenue(input: LogRevenueInput): Promise<LogRevenueResult>;
