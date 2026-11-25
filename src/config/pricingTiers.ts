/**
 * Editable Paddle pricing tiers. Update names/features here;
 * price IDs come from VITE_PADDLE_* env vars (never hard-code live IDs).
 */

export type BillingFrequency = "month" | "year";

export type TierName = "Starter" | "Pro" | "Advanced";

export type TierId = "starter" | "pro" | "advanced";

export interface Tier {
  name: TierName;
  id: TierId;
  description: string;
  features: string[];
  featured: boolean;
  /** Membership entitlement this price grants after webhook sync. */
  membership: "next_level" | "pantheon";
  priceId: { month: string; year: string };
}

function trim(value: string | undefined): string {
  return (value ?? "").trim();
}

function requiredPrice(name: string, ...candidates: Array<string | undefined>): string {
  for (const candidate of candidates) {
    const value = trim(candidate);
    if (value) return value;
  }
  throw new Error(`Missing Paddle price id env: ${name}`);
}

/**
 * Builds tiers from env. Throws if any required price id is missing
 * so we never open checkout against a wrong/empty catalog entry.
 */
export function readPricingTiers(): Tier[] {
  const starterMonth = requiredPrice(
    "VITE_PADDLE_STARTER_MONTH_PRICE_ID (or VITE_PADDLE_NEXT_LEVEL_PRICE_ID)",
    import.meta.env.VITE_PADDLE_STARTER_MONTH_PRICE_ID as string | undefined,
    import.meta.env.VITE_PADDLE_NEXT_LEVEL_PRICE_ID as string | undefined,
  );
  const starterYear = requiredPrice(
    "VITE_PADDLE_STARTER_YEAR_PRICE_ID",
    import.meta.env.VITE_PADDLE_STARTER_YEAR_PRICE_ID as string | undefined,
  );
  const proMonth = requiredPrice(
    "VITE_PADDLE_PRO_MONTH_PRICE_ID",
    import.meta.env.VITE_PADDLE_PRO_MONTH_PRICE_ID as string | undefined,
  );
  const proYear = requiredPrice(
    "VITE_PADDLE_PRO_YEAR_PRICE_ID",
    import.meta.env.VITE_PADDLE_PRO_YEAR_PRICE_ID as string | undefined,
  );
  const advancedMonth = requiredPrice(
    "VITE_PADDLE_ADVANCED_MONTH_PRICE_ID (or VITE_PADDLE_PANTHEON_PRICE_ID)",
    import.meta.env.VITE_PADDLE_ADVANCED_MONTH_PRICE_ID as string | undefined,
    import.meta.env.VITE_PADDLE_PANTHEON_PRICE_ID as string | undefined,
  );
  const advancedYear = requiredPrice(
    "VITE_PADDLE_ADVANCED_YEAR_PRICE_ID",
    import.meta.env.VITE_PADDLE_ADVANCED_YEAR_PRICE_ID as string | undefined,
  );

  return [
    {
      name: "Starter",
      id: "starter",
      description: "Hera, scans, and wallet-aware tools to get going.",
      features: [
        "Hera conversation and market discovery",
        "Token security checks",
        "Connect any Solana wallet via WalletConnect",
        "Read-only holdings and advisory risk analysis",
        "Members-only social network is not included",
      ],
      featured: false,
      membership: "next_level",
      priceId: { month: starterMonth, year: starterYear },
    },
    {
      name: "Pro",
      id: "pro",
      description: "Deeper Hera access and priority surfaces for active operators.",
      features: [
        "Everything in Starter",
        "Priority Hera capabilities",
        "Faster refresh on intel surfaces",
        "Members-only social network is not included",
        "SyNexus platform fee still applies on future swaps",
      ],
      featured: true,
      membership: "next_level",
      priceId: { month: proMonth, year: proYear },
    },
    {
      name: "Advanced",
      id: "advanced",
      description: "Full Pantheon access — community plus zero SyNexus trading fees.",
      features: [
        "Everything in Pro",
        "Members-only social network",
        "Premium Hera capabilities",
        "Zero SyNexus platform trading/swap fees when trading is enabled",
        "Blockchain and third-party venue fees still apply",
      ],
      featured: false,
      membership: "pantheon",
      priceId: { month: advancedMonth, year: advancedYear },
    },
  ];
}

export function allTierPriceIds(tiers: Tier[]): string[] {
  return tiers.flatMap((tier) => [tier.priceId.month, tier.priceId.year]);
}

/** Canonical store product id written by the webhook ledger. */
export function canonicalProductForTier(id: TierId, frequency: BillingFrequency): string {
  if (id === "advanced") {
    return frequency === "year" ? "the_pantheon_annual" : "the_pantheon_monthly";
  }
  if (id === "pro") {
    return frequency === "year" ? "pro_annual" : "pro_monthly";
  }
  return frequency === "year" ? "starter_annual" : "starter_monthly";
}
