/** Public Paddle.js / checkout config (VITE_* only). Never put API keys or webhook secrets here. */

export type PaddlePlanId = "next_level" | "pantheon";

export type PaddlePublicConfig = {
  clientToken: string;
  nextLevelPriceId: string;
  pantheonPriceId: string;
  nextLevelPriceIdNoTrial: string | null;
  pantheonPriceIdNoTrial: string | null;
  environment: "sandbox" | "production";
};

function trim(value: string | undefined): string {
  return (value ?? "").trim();
}

export function readPaddlePublicConfig(): PaddlePublicConfig | null {
  const clientToken = trim(import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined);
  const nextLevelPriceId = trim(import.meta.env.VITE_PADDLE_NEXT_LEVEL_PRICE_ID as string | undefined);
  const pantheonPriceId = trim(import.meta.env.VITE_PADDLE_PANTHEON_PRICE_ID as string | undefined);
  if (!clientToken || !nextLevelPriceId || !pantheonPriceId) return null;
  const envHint = trim(import.meta.env.VITE_PADDLE_ENVIRONMENT as string | undefined).toLowerCase();
  return {
    clientToken,
    nextLevelPriceId,
    pantheonPriceId,
    nextLevelPriceIdNoTrial: trim(import.meta.env.VITE_PADDLE_NEXT_LEVEL_PRICE_ID_NO_TRIAL as string | undefined) || null,
    pantheonPriceIdNoTrial: trim(import.meta.env.VITE_PADDLE_PANTHEON_PRICE_ID_NO_TRIAL as string | undefined) || null,
    environment: envHint === "sandbox" || clientToken.includes("_sdbx_") ? "sandbox" : "production",
  };
}

export function isPaddleCheckoutConfigured(): boolean {
  return readPaddlePublicConfig() !== null;
}

/**
 * Live/production checkout stays off until you set VITE_PADDLE_LIVE_CHECKOUT=true
 * after Paddle business eligibility + your explicit approval.
 * Sandbox tokens can open checkout without that flag.
 */
export function isPaddleLiveCheckoutEnabled(): boolean {
  const config = readPaddlePublicConfig();
  if (!config) return false;
  if (config.environment === "sandbox") return true;
  const flag = trim(import.meta.env.VITE_PADDLE_LIVE_CHECKOUT as string | undefined).toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}

export function paddlePriceIdForPlan(plan: PaddlePlanId, trialEligible: boolean): string | null {
  const config = readPaddlePublicConfig();
  if (!config) return null;
  if (plan === "pantheon") {
    if (!trialEligible && config.pantheonPriceIdNoTrial) return config.pantheonPriceIdNoTrial;
    return config.pantheonPriceId;
  }
  if (!trialEligible && config.nextLevelPriceIdNoTrial) return config.nextLevelPriceIdNoTrial;
  return config.nextLevelPriceId;
}
