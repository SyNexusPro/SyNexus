import { createSquareCheckoutResponse } from "../square/checkout";
import {
  isSubscriptionConfigured,
  SUBSCRIPTION_NOT_CONFIGURED_MESSAGE,
  type SubscriptionEnv,
} from "./config";
import type { CheckoutPayload, JsonResponse } from "./types";

export type { CheckoutPayload, JsonResponse };

export async function createSubscriptionCheckoutResponse(
  payload: CheckoutPayload,
  headers: Record<string, string | string[] | undefined>,
  env: SubscriptionEnv,
): Promise<JsonResponse> {
  if (!isSubscriptionConfigured(env)) {
    return {
      statusCode: 503,
      body: { error: SUBSCRIPTION_NOT_CONFIGURED_MESSAGE },
    };
  }

  return createSquareCheckoutResponse(payload, headers, env);
}
