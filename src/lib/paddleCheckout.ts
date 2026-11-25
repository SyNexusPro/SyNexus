import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import {
  isPaddleCheckoutConfigured,
  requirePaddleClientToken,
  requirePaddleEnvironment,
} from "../config/paddle";
import type { BillingFrequency, TierId } from "../config/pricingTiers";
import { authHeaders } from "./authSession";

let paddlePromise: Promise<Paddle | undefined> | null = null;

/** Production default payment link for Paddle Checkout settings (must be approved domain). */
export const PADDLE_DEFAULT_PAYMENT_LINK = "https://www.synexus.pro/pricing";

export async function getPaddleInstance(): Promise<Paddle | undefined> {
  if (!paddlePromise) {
    try {
      const token = requirePaddleClientToken();
      const environment = requirePaddleEnvironment();
      paddlePromise = initializePaddle({ token, environment }).catch((error) => {
        console.error("[paddle] init failed", error);
        paddlePromise = null;
        return undefined;
      });
    } catch (error) {
      console.error("[paddle] config error", error);
      return undefined;
    }
  }
  return paddlePromise;
}

export function paddleCheckoutAvailable(): boolean {
  return isPaddleCheckoutConfigured();
}

export function paddleConfiguredButAwaitingApproval(): boolean {
  return false;
}

export type OpenPaddleCheckoutInput = {
  priceId: string;
  tierId: TierId;
  frequency: BillingFrequency;
  /** Required so webhooks can grant membership to the SyNexus account. */
  userId: string;
  /** Verified signed-in email only. Never a company/support fallback. */
  email?: string | null;
};

/**
 * Opens one-page overlay checkout for the exact price id shown on the pricing card.
 * Prefills only the authenticated customer's verified email; otherwise Paddle collects email.
 */
export async function openPaddleCheckout(input: OpenPaddleCheckoutInput): Promise<void> {
  const priceId = input.priceId.trim();
  if (!priceId) throw new Error("Missing Paddle price id.");

  const userId = input.userId.trim();
  if (!userId) {
    throw new Error("Sign in to subscribe so your membership can be linked to your account.");
  }

  const paddle = await getPaddleInstance();
  if (!paddle) throw new Error("Paddle.js failed to load. Check VITE_PADDLE_ENVIRONMENT and VITE_PADDLE_CLIENT_TOKEN.");

  const email = input.email?.trim() || undefined;
  const origin = window.location.origin;

  paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    ...(email ? { customer: { email } } : {}),
    customData: {
      user_id: userId,
      tier: input.tierId,
      frequency: input.frequency,
    },
    settings: {
      displayMode: "overlay",
      variant: "one-page",
      theme: "dark",
      successUrl: `${origin}/welcome`,
    },
  });
}

export async function openPaddleCustomerPortal(): Promise<string> {
  const response = await fetch("/api/paddle/portal", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: "{}",
  });
  const body = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!response.ok || !body?.url) {
    throw new Error(body?.error || "Could not open the subscription portal.");
  }
  return body.url;
}
