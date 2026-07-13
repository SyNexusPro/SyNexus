import { randomUUID } from "node:crypto";
import { SYNEXUS_PRO_PRICE_USD } from "../subscription/pricing.js";
import { readSquareConfig, type SquareEnv } from "./config.js";
import { resolvePlanVariationId } from "./resolvePlanVariation.js";
import type { CheckoutPayload, JsonResponse } from "../subscription/types.js";

type SquarePaymentLinkResponse = {
  payment_link?: {
    url?: string;
    long_url?: string;
  };
  errors?: { detail?: string; code?: string }[];
};

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function createSquareCheckoutResponse(
  payload: CheckoutPayload,
  headers: Record<string, string | string[] | undefined>,
  env: SquareEnv,
): Promise<JsonResponse> {
  const { accessToken, locationId, planVariationIdPro, apiBase, appUrl: configuredAppUrl } =
    readSquareConfig(env);

  if (!accessToken || !locationId || !planVariationIdPro) {
    return {
      statusCode: 503,
      body: {
        error:
          "Square subscription is not configured. Set SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, and SQUARE_PLAN_VARIATION_ID_PRO.",
      },
    };
  }

  if (payload.plan !== "PRO") {
    return { statusCode: 400, body: { error: "Invalid plan" } };
  }

  const resolved = await resolvePlanVariationId(apiBase, accessToken, planVariationIdPro);
  if (resolved.source === "invalid_webhook_id") {
    return {
      statusCode: 503,
      body: {
        error:
          "SQUARE_PLAN_VARIATION_ID_PRO looks like a webhook ID (wbhk_...). Use your subscription plan SKU or catalog variation ID.",
      },
    };
  }
  if (!resolved.id) {
    return {
      statusCode: 503,
      body: { error: "Square subscription plan is not configured (missing SKU or plan variation ID)." },
    };
  }

  const requestOrigin = getHeaderValue(headers.origin);
  const requestHost = getHeaderValue(headers.host);
  const appUrl =
    requestOrigin ||
    configuredAppUrl ||
    (requestHost ? `https://${requestHost}` : "http://localhost:5173");

  const userId = payload.userId?.trim();
  const amountCents = Math.round(SYNEXUS_PRO_PRICE_USD * 100);
  const redirectParams = new URLSearchParams({ checkout: "success", plan: "PRO" });
  if (userId) redirectParams.set("userId", userId);

  try {
    const response = await fetch(`${apiBase}/v2/online-checkout/payment-links`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": "2026-05-20",
      },
      body: JSON.stringify({
        idempotency_key: randomUUID(),
        description: "Synexus Pro subscription",
        quick_pay: {
          name: "Synexus Pro",
          price_money: { amount: amountCents, currency: "USD" },
          location_id: locationId,
        },
        checkout_options: {
          subscription_plan_id: resolved.id,
          redirect_url: `${appUrl}/pulse?${redirectParams.toString()}`,
        },
        payment_note: userId ? `synexus-user:${userId}` : undefined,
        pre_populated_data: payload.email?.trim()
          ? { buyer_email: payload.email.trim() }
          : undefined,
      }),
    });

    const data = (await response.json()) as SquarePaymentLinkResponse;
    const url = data.payment_link?.url || data.payment_link?.long_url;

    if (!response.ok || !url) {
      const detail = data.errors?.map((e) => e.detail || e.code).filter(Boolean).join("; ");
      return {
        statusCode: response.status >= 400 && response.status < 500 ? response.status : 500,
        body: { error: detail || "Square checkout could not be started." },
      };
    }

    return { statusCode: 200, body: { url } };
  } catch {
    return {
      statusCode: 500,
      body: { error: "Checkout could not be started. Please try again in a moment." },
    };
  }
}
