import {
  SUBSCRIPTION_NOT_CONFIGURED_MESSAGE,
  type SubscriptionEnv,
} from "./config.js";
import type { CheckoutPayload, JsonResponse } from "./types.js";

export type { CheckoutPayload, JsonResponse };

export async function createSubscriptionCheckoutResponse(
  _payload: CheckoutPayload,
  _headers: Record<string, string | string[] | undefined>,
  _env: SubscriptionEnv,
): Promise<JsonResponse> {
  return {
    statusCode: 503,
    body: { error: SUBSCRIPTION_NOT_CONFIGURED_MESSAGE },
  };
}
