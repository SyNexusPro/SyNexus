/** SyNexusPro subscription price (USD). Keep in sync with Square catalog. */
export { SYNEXUS_BRAND_NAME, SYNEXUS_PRO_PRODUCT_NAME, SYNEXUS_PRO_SKU } from "./brand";
export const SYNEXUS_PRO_PRICE_USD = 9.99;

export const SYNEXUS_PRO_PRICE_LABEL = `$${SYNEXUS_PRO_PRICE_USD.toFixed(2)}/month`;

export const SYNEXUS_PRO_PRICE_SHORT = `$${SYNEXUS_PRO_PRICE_USD.toFixed(2)}/mo`;

export const SYNEXUS_PRO_SUBSCRIBE_LABEL = `Subscribe — ${SYNEXUS_PRO_PRICE_LABEL}`;

/** Marketing / in-app offer line (30-day free Pro on sign-up — no card). */
export const SYNEXUS_PRO_OFFER_TAGLINE = `30 days of Pro free when you sign up · no card · ${SYNEXUS_PRO_PRICE_SHORT} after · cancel anytime`;

export const SYNEXUS_PRO_OFFER_SHORT = `30 days Pro free on sign-up · no card · ${SYNEXUS_PRO_PRICE_SHORT} after`;

export const SYNEXUS_PRO_FEATURES = [
  "Unlimited SyNexus access",
  "Real-time Sentinel signals",
  "Scam and risk alerts",
  "Whale activity tracking",
  "Whale-buy push alerts (seconds)",
  "Momentum and trend analysis",
  "Pattern recognition insights",
  "Fast trading links",
  "Priority platform updates",
] as const;

/** In-app pricing sheet route. */
export const SYNEXUS_PRICING_PATH = "/pricing";

/**
 * Optional external pricing / checkout page (your subscription platform).
 * Set VITE_SUBSCRIPTION_PRICING_URL in .env when available.
 */
export function getExternalPricingUrl(): string | null {
  const explicit = import.meta.env.VITE_SUBSCRIPTION_PRICING_URL?.trim();
  return explicit || null;
}
