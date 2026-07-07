/** Synexus Pro subscription price (USD). Keep in sync with Stripe / Lemon Squeezy price. */
export const SYNEXUS_PRO_PRICE_USD = 9.99;

export const SYNEXUS_PRO_PRICE_LABEL = `$${SYNEXUS_PRO_PRICE_USD.toFixed(2)}/month`;

export const SYNEXUS_PRO_PRICE_SHORT = `$${SYNEXUS_PRO_PRICE_USD.toFixed(2)}/mo`;

export const SYNEXUS_PRO_SUBSCRIBE_LABEL = `Subscribe — ${SYNEXUS_PRO_PRICE_LABEL}`;

/** Marketing / in-app offer line (trial is app-granted after sign-up — no card to start). */
export const SYNEXUS_PRO_OFFER_TAGLINE =
  "7-day free Pro trial · sign up free · $9.99/mo after · cancel anytime";

export const SYNEXUS_PRO_OFFER_SHORT = "7-day free trial · $9.99/mo after · no card to start";
