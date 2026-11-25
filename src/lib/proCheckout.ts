import { androidRequiresWebSubscription, openWebSubscription } from "./androidSubscription";
import { openPaddleCheckout, paddleCheckoutAvailable } from "./paddleCheckout";
import { SYNEXUS_PRICING_PATH } from "../config/proPricing";
import { readPricingTiers, type BillingFrequency, type TierId } from "../config/pricingTiers";

export type StartProCheckoutInput = {
  userId?: string | null;
  email?: string | null;
  /** Defaults to advanced (top tier / Pantheon). */
  plan?: TierId | "pantheon" | "next_level";
  frequency?: BillingFrequency;
  trialEligible?: boolean;
};

export type StartProCheckoutResult =
  | { ok: true; url: string; openedExternally?: boolean; openedOverlay?: boolean }
  | { ok: false; error: string; needsSignIn?: boolean };

function resolveTierId(plan: StartProCheckoutInput["plan"]): TierId {
  if (plan === "starter" || plan === "pro" || plan === "advanced") return plan;
  if (plan === "next_level") return "starter";
  return "advanced";
}

/**
 * Opens Paddle overlay for the requested tier, or sends the user to Pricing.
 */
export async function startProCheckout(
  input: StartProCheckoutInput = {},
): Promise<StartProCheckoutResult> {
  if (androidRequiresWebSubscription()) {
    await openWebSubscription();
    return { ok: true, url: "", openedExternally: true };
  }

  const tierId = resolveTierId(input.plan);
  const frequency = input.frequency ?? "month";

  if (paddleCheckoutAvailable()) {
    try {
      const tiers = readPricingTiers();
      const tier = tiers.find((item) => item.id === tierId) ?? tiers[tiers.length - 1];
      if (!tier) {
        return { ok: false, error: "Pricing tiers are not configured." };
      }
      await openPaddleCheckout({
        priceId: tier.priceId[frequency],
        tierId: tier.id,
        frequency,
        userId: input.userId,
        email: input.email,
      });
      return { ok: true, url: "", openedOverlay: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Checkout could not be opened.",
        needsSignIn: !input.userId,
      };
    }
  }

  return {
    ok: true,
    url: `${SYNEXUS_PRICING_PATH}?plan=${tierId}`,
  };
}

export function redirectToProCheckout(url: string) {
  if (!url.trim()) return;
  window.location.href = url;
}
