export type SubscriptionProvider = "stripe" | "creem" | "none";

export type SubscriptionEnv = {
  SUBSCRIPTION_PROVIDER?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_ID_PRO?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  CREEM_API_KEY?: string;
  CREEM_PRODUCT_ID_PRO?: string;
  CREEM_WEBHOOK_SECRET?: string;
  VITE_APP_URL?: string;
};

/** Which billing backend is active. Set SUBSCRIPTION_PROVIDER or leave unset to auto-detect from env keys. */
export function resolveSubscriptionProvider(env: SubscriptionEnv): SubscriptionProvider {
  const explicit = env.SUBSCRIPTION_PROVIDER?.trim().toLowerCase();
  if (explicit === "stripe" || explicit === "creem" || explicit === "none") {
    return explicit;
  }

  if (env.STRIPE_SECRET_KEY?.trim() && env.STRIPE_PRICE_ID_PRO?.trim()) {
    return "stripe";
  }
  if (env.CREEM_API_KEY?.trim() && env.CREEM_PRODUCT_ID_PRO?.trim()) {
    return "creem";
  }
  return "none";
}

export function subscriptionProviderLabel(provider: SubscriptionProvider): string {
  if (provider === "stripe") return "Stripe";
  if (provider === "creem") return "Creem";
  return "subscription platform";
}

export const SUBSCRIPTION_NOT_CONFIGURED_MESSAGE =
  "Synexus Pro checkout is being connected to our subscription platform. Try again soon or contact support.";
