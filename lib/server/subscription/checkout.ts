import {
  SUBSCRIPTION_NOT_CONFIGURED_MESSAGE,
  type SubscriptionEnv,
} from "./config.js";
import { isPaddleLiveCheckoutEnabled, isPaddleServerConfigured } from "./paddleEnv.js";
import type { CheckoutPayload, JsonResponse } from "./types.js";

export type { CheckoutPayload, JsonResponse };

/**
 * Server-side card checkout is retired. Web billing uses client-side Paddle.js
 * (see src/lib/paddleCheckout.ts). This endpoint stays as a clear 503 so old
 * clients do not look for a missing redirect URL.
 */
export async function createSubscriptionCheckoutResponse(
  _payload: CheckoutPayload,
  _headers: Record<string, string | string[] | undefined>,
  env: SubscriptionEnv,
): Promise<JsonResponse> {
  if (isPaddleServerConfigured(env) && isPaddleLiveCheckoutEnabled(env)) {
    return {
      statusCode: 503,
      body: {
        error:
          "Use Paddle overlay checkout from the Pricing page. Server redirect checkout is not used.",
      },
    };
  }
  if (isPaddleServerConfigured(env)) {
    return {
      statusCode: 503,
      body: {
        error:
          "Paddle is configured but live checkout is awaiting approval (VITE_PADDLE_LIVE_CHECKOUT).",
      },
    };
  }
  return {
    statusCode: 503,
    body: { error: SUBSCRIPTION_NOT_CONFIGURED_MESSAGE },
  };
}
