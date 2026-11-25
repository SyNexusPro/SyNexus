import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import {
  isPaddleCheckoutConfigured,
  requirePaddleClientToken,
  requirePaddleEnvironment,
} from "../config/paddle";
import type { BillingFrequency, TierId } from "../config/pricingTiers";
import { authHeaders } from "./authSession";

let paddlePromise: Promise<Paddle | undefined> | null = null;

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
  userId?: string | null;
  email?: string | null;
};

/** Opens one-page overlay checkout for the exact price id shown on the pricing card. */
export async function openPaddleCheckout(input: OpenPaddleCheckoutInput): Promise<void> {
  const priceId = input.priceId.trim();
  if (!priceId) throw new Error("Missing Paddle price id.");

  const paddle = await getPaddleInstance();
  if (!paddle) throw new Error("Paddle.js failed to load. Check VITE_PADDLE_ENVIRONMENT and VITE_PADDLE_CLIENT_TOKEN.");

  const email = input.email?.trim();
  const userId = input.userId?.trim();
  const origin = window.location.origin;

  paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    ...(email ? { customer: { email } } : {}),
    ...(userId
      ? {
          customData: {
            user_id: userId,
            tier: input.tierId,
            frequency: input.frequency,
          },
        }
      : {}),
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
