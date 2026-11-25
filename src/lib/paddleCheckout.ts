import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import {
  isPaddleCheckoutConfigured,
  isPaddleLiveCheckoutEnabled,
  paddlePriceIdForPlan,
  readPaddlePublicConfig,
  type PaddlePlanId,
} from "../config/paddle";
import { authHeaders } from "./authSession";

let paddlePromise: Promise<Paddle | undefined> | null = null;

async function getPaddle(): Promise<Paddle | undefined> {
  const config = readPaddlePublicConfig();
  if (!config || !isPaddleLiveCheckoutEnabled()) return undefined;
  if (!paddlePromise) {
    paddlePromise = initializePaddle({
      token: config.clientToken,
      environment: config.environment,
    }).catch((error) => {
      console.error("[paddle] init failed", error);
      paddlePromise = null;
      return undefined;
    });
  }
  return paddlePromise;
}

export function paddleCheckoutAvailable(): boolean {
  return isPaddleCheckoutConfigured() && isPaddleLiveCheckoutEnabled();
}

export function paddleConfiguredButAwaitingApproval(): boolean {
  return isPaddleCheckoutConfigured() && !isPaddleLiveCheckoutEnabled();
}

export type OpenPaddleCheckoutInput = {
  plan: PaddlePlanId;
  userId: string;
  email?: string | null;
  trialEligible?: boolean;
};

export async function openPaddleCheckout(input: OpenPaddleCheckoutInput): Promise<void> {
  if (!paddleCheckoutAvailable()) {
    throw new Error(
      paddleConfiguredButAwaitingApproval()
        ? "Paddle is configured but live checkout is awaiting approval."
        : "Paddle checkout is not configured.",
    );
  }
  const userId = input.userId.trim();
  if (!userId) throw new Error("Sign in before starting checkout.");

  const priceId = paddlePriceIdForPlan(input.plan, input.trialEligible !== false);
  if (!priceId) throw new Error("Paddle price id is missing for that plan.");

  const paddle = await getPaddle();
  if (!paddle) throw new Error("Paddle.js failed to load.");

  const email = input.email?.trim();
  paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customer: email ? { email } : undefined,
    customData: {
      user_id: userId,
      tier: input.plan,
    },
    settings: {
      displayMode: "overlay",
      theme: "dark",
      successUrl: `${window.location.origin}/pricing?checkout=success&plan=${input.plan}`,
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
