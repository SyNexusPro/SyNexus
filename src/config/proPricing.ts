/** Membership prices (USD). Keep in sync with Paddle prices and server policy. */
export { SYNEXUS_BRAND_NAME, SYNEXUS_PRO_PRODUCT_NAME, SYNEXUS_PRO_SKU } from "./brand";

export const SYNEXUS_NEXT_LEVEL_PRICE_USD = 10;
export const SYNEXUS_PANTHEON_PRICE_USD = 20;

/** @deprecated Use SYNEXUS_NEXT_LEVEL_PRICE_USD — kept so older imports resolve to the current entry plan. */
export const SYNEXUS_PRO_PRICE_USD = SYNEXUS_NEXT_LEVEL_PRICE_USD;

export const SYNEXUS_NEXT_LEVEL_PRICE_LABEL = `$${SYNEXUS_NEXT_LEVEL_PRICE_USD}/month`;
export const SYNEXUS_PANTHEON_PRICE_LABEL = `$${SYNEXUS_PANTHEON_PRICE_USD}/month`;

export const SYNEXUS_PRO_PRICE_LABEL = SYNEXUS_NEXT_LEVEL_PRICE_LABEL;
export const SYNEXUS_PRO_PRICE_SHORT = `$${SYNEXUS_NEXT_LEVEL_PRICE_USD}/mo`;

export const SYNEXUS_PRO_SUBSCRIBE_LABEL = `Subscribe — ${SYNEXUS_NEXT_LEVEL_PRICE_LABEL}`;

/** Marketing / in-app offer line (one-time complimentary Next Level grant — no card). */
export const SYNEXUS_PRO_OFFER_TAGLINE =
  `30-day complimentary Next Level access when eligible · no card · not a store subscription trial · then ${SYNEXUS_PRO_PRICE_SHORT} or Pantheon at $${SYNEXUS_PANTHEON_PRICE_USD}/mo`;

export const SYNEXUS_PRO_OFFER_SHORT =
  `30-day Next Level grant · no card · not a payment-provider trial · ${SYNEXUS_PRO_PRICE_SHORT} after`;

export const SYNEXUS_PRO_FEATURES = [
  "Hera conversation, market discovery, and token security checks",
  "Connect any Solana wallet via WalletConnect",
  "Read-only holdings and advisory token-risk analysis",
  "Pantheon: members-only social + future $0 SyNexus swap fee when trading is enabled",
  "Blockchain and third-party venue fees still apply",
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
