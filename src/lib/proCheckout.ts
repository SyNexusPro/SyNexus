import { androidRequiresWebSubscription, openWebSubscription } from "./androidSubscription";
import { isEmailVerified } from "./emailVerification";
import { openPaddleCheckout, paddleCheckoutAvailable } from "./paddleCheckout";
import { getCurrentUser } from "./supabaseData";
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
 * Requires a signed-in account. Prefills only a verified email.
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
  const userId = input.userId?.trim();

  if (!userId) {
    return {
      ok: false,
      error: "Sign in to subscribe so your membership can be linked to your account.",
      needsSignIn: true,
    };
  }

  if (paddleCheckoutAvailable()) {
    try {
      const user = await getCurrentUser().catch(() => null);
      if (user && !isEmailVerified(user)) {
        return {
          ok: false,
          error: "Verify your email, then return here to subscribe.",
          needsSignIn: false,
        };
      }
      // Prefill only the authenticated verified email. Never company/support fallbacks.
      const email = user && isEmailVerified(user) ? user.email?.trim() || null : null;

      const tiers = readPricingTiers();
      const tier = tiers.find((item) => item.id === tierId) ?? tiers[tiers.length - 1];
      if (!tier) {
        return { ok: false, error: "Pricing tiers are not configured." };
      }
      await openPaddleCheckout({
        priceId: tier.priceId[frequency],
        tierId: tier.id,
        frequency,
        userId,
        email,
      });
      return { ok: true, url: "", openedOverlay: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Checkout could not be opened.",
        needsSignIn: !userId,
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
