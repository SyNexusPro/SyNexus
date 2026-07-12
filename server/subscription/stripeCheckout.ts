import Stripe from "stripe";
import type { CheckoutPayload, JsonResponse } from "../creem/checkout";

type StripeCheckoutEnv = {
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_ID_PRO?: string;
  VITE_APP_URL?: string;
};

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function createStripeCheckoutResponse(
  payload: CheckoutPayload,
  headers: Record<string, string | string[] | undefined>,
  env: StripeCheckoutEnv,
): Promise<JsonResponse> {
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  const priceId = env.STRIPE_PRICE_ID_PRO?.trim();

  if (!secretKey || !priceId) {
    return {
      statusCode: 503,
      body: { error: "Stripe subscription is not configured on the server." },
    };
  }

  if (payload.plan !== "PRO") {
    return { statusCode: 400, body: { error: "Invalid plan" } };
  }

  const requestOrigin = getHeaderValue(headers.origin);
  const requestHost = getHeaderValue(headers.host);
  const appUrl =
    requestOrigin ||
    env.VITE_APP_URL ||
    (requestHost ? `https://${requestHost}` : "http://localhost:5173");

  const userId = payload.userId?.trim();
  const email = payload.email?.trim();

  try {
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/pulse?checkout=success&plan=PRO`,
      cancel_url: `${appUrl}/pulse?checkout=cancel`,
      client_reference_id: userId || undefined,
      customer_email: email || undefined,
      metadata: {
        plan: "PRO",
        userId: userId || "anonymous",
      },
      subscription_data: {
        metadata: {
          plan: "PRO",
          userId: userId || "anonymous",
        },
      },
    });

    if (!session.url) {
      return { statusCode: 500, body: { error: "Checkout could not be started." } };
    }

    return { statusCode: 200, body: { url: session.url } };
  } catch {
    return {
      statusCode: 500,
      body: { error: "Checkout could not be started. Please try again in a moment." },
    };
  }
}
