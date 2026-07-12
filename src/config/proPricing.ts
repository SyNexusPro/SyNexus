/** Synexus Pro subscription price (USD). Keep in sync with your subscription product. */
export const SYNEXUS_PRO_PRICE_USD = 9.99;

export const SYNEXUS_PRO_PRICE_LABEL = `$${SYNEXUS_PRO_PRICE_USD.toFixed(2)}/month`;

export const SYNEXUS_PRO_PRICE_SHORT = `$${SYNEXUS_PRO_PRICE_USD.toFixed(2)}/mo`;

export const SYNEXUS_PRO_SUBSCRIBE_LABEL = `Subscribe — ${SYNEXUS_PRO_PRICE_LABEL}`;

/** Marketing / in-app offer line (7-day trial — card on file at signup). */
export const SYNEXUS_PRO_OFFER_TAGLINE = `7-day Pro trial · card on file · ${SYNEXUS_PRO_PRICE_SHORT} after · cancel anytime`;

export const SYNEXUS_PRO_OFFER_SHORT = `7-day free trial · card on file · ${SYNEXUS_PRO_PRICE_SHORT} after`;

export const SYNEXUS_PRO_FEATURES = [
  "Unlimited Synexus access",
  "Real-time Sentinel signals",
  "Scam and risk alerts",
  "Whale activity tracking",
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
  if (explicit) return explicit;

  // Legacy env aliases — remove once subscription platform is finalized
  const legacyCreem = import.meta.env.VITE_CREEM_PRICING_URL?.trim();
  if (legacyCreem) return legacyCreem;

  return null;
}

/** @deprecated Use getExternalPricingUrl */
export function getCreemPricingSheetUrl(): string | null {
  return getExternalPricingUrl();
}
