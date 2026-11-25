import { androidRequiresWebSubscription, openWebSubscription } from "./androidSubscription";
import {
  openPaddleCheckout,
  paddleCheckoutAvailable,
  paddleConfiguredButAwaitingApproval,
} from "./paddleCheckout";
import { SYNEXUS_PRICING_PATH } from "../config/proPricing";

export type StartProCheckoutInput = {
  userId?: string | null;
  email?: string | null;
  /** Defaults to pantheon (legacy "PRO"). Use next_level for the entry plan. */
  plan?: "next_level" | "pantheon";
  trialEligible?: boolean;
};

export type StartProCheckoutResult =
  | { ok: true; url: string; openedExternally?: boolean; openedOverlay?: boolean }
  | { ok: false; error: string; needsSignIn?: boolean };

/**
 * Opens Paddle overlay when live checkout is enabled; otherwise sends the user to Pricing.
 * RevenueCat paths stay archived and are not used here.
 */
export async function startProCheckout(
  input: StartProCheckoutInput = {},
): Promise<StartProCheckoutResult> {
  if (androidRequiresWebSubscription()) {
    await openWebSubscription();
    return { ok: true, url: "", openedExternally: true };
  }

  const userId = input.userId?.trim();
  const email = input.email?.trim();
  const plan = input.plan ?? "pantheon";

  if (paddleCheckoutAvailable()) {
    if (!userId) {
      return { ok: false, error: "Sign in before starting checkout.", needsSignIn: true };
    }
    await openPaddleCheckout({
      plan,
      userId,
      email,
      trialEligible: input.trialEligible !== false,
    });
    return { ok: true, url: "", openedOverlay: true };
  }

  if (paddleConfiguredButAwaitingApproval()) {
    return {
      ok: false,
      error:
        "Paddle is configured but live checkout is awaiting approval (VITE_PADDLE_LIVE_CHECKOUT).",
    };
  }

  return {
    ok: true,
    url: `${SYNEXUS_PRICING_PATH}?plan=${plan}`,
  };
}

export function redirectToProCheckout(url: string) {
  if (!url.trim()) return;
  window.location.href = url;
}
