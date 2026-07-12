import { createCreemCheckoutResponse, type CheckoutPayload, type JsonResponse } from "../creem/checkout";
import {
  resolveSubscriptionProvider,
  SUBSCRIPTION_NOT_CONFIGURED_MESSAGE,
  type SubscriptionEnv,
} from "./config";
import { createStripeCheckoutResponse } from "./stripeCheckout";

export type { CheckoutPayload, JsonResponse };

export async function createSubscriptionCheckoutResponse(
  payload: CheckoutPayload,
  headers: Record<string, string | string[] | undefined>,
  env: SubscriptionEnv,
): Promise<JsonResponse> {
  const provider = resolveSubscriptionProvider(env);

  if (provider === "stripe") {
    return createStripeCheckoutResponse(payload, headers, env);
  }

  if (provider === "creem") {
    return createCreemCheckoutResponse(payload, headers, env);
  }

  return {
    statusCode: 503,
    body: { error: SUBSCRIPTION_NOT_CONFIGURED_MESSAGE },
  };
}
