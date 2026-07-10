import { readCreemConfig, type CreemEnv } from "./config";

type PaidPlan = "PRO";

export type CheckoutPayload = {
  plan?: PaidPlan;
  email?: string;
  userId?: string;
};

export type JsonResponse = {
  statusCode: number;
  body: { url?: string; error?: string };
};

type CreemCheckoutResponse = {
  id?: string;
  checkout_url?: string;
  status?: string;
  message?: string | string[];
  error?: string;
};

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getCheckoutErrorMessage(error: unknown, apiBody?: CreemCheckoutResponse) {
  if (apiBody?.message) {
    const msg = Array.isArray(apiBody.message) ? apiBody.message.join(", ") : apiBody.message;
    if (msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("api key")) {
      return "Payments are not configured correctly on the server. Please try again later.";
    }
    if (msg.toLowerCase().includes("product")) {
      return "Subscription pricing is not set up yet. Please contact support.";
    }
  }

  if (!(error instanceof Error)) {
    return "Checkout is temporarily unavailable. Please try again shortly.";
  }

  return "Checkout could not be started. Please try again in a moment.";
}

export async function createCreemCheckoutResponse(
  payload: CheckoutPayload,
  headers: Record<string, string | string[] | undefined>,
  env: CreemEnv,
): Promise<JsonResponse> {
  const { apiKey, productIdPro, apiBase } = readCreemConfig(env);

  if (!apiKey || !productIdPro) {
    return {
      statusCode: 500,
      body: {
        error: "Payments are not configured. Set CREEM_API_KEY and CREEM_PRODUCT_ID_PRO.",
      },
    };
  }

  const plan = payload.plan;
  if (plan !== "PRO") {
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
    const response = await fetch(`${apiBase}/v1/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        product_id: productIdPro,
        success_url: `${appUrl}/pulse?checkout=success&plan=PRO`,
        request_id: userId ? `synexus-${userId}-${Date.now()}` : undefined,
        customer: email ? { email } : undefined,
        metadata: {
          plan: "PRO",
          userId: userId || "anonymous",
        },
      }),
    });

    const data = (await response.json()) as CreemCheckoutResponse;
    if (!response.ok || !data.checkout_url) {
      return {
        statusCode: response.status >= 400 && response.status < 500 ? response.status : 500,
        body: { error: getCheckoutErrorMessage(new Error(data.error ?? "Creem checkout failed"), data) },
      };
    }

    return { statusCode: 200, body: { url: data.checkout_url } };
  } catch (error) {
    return {
      statusCode: 500,
      body: { error: getCheckoutErrorMessage(error) },
    };
  }
}
