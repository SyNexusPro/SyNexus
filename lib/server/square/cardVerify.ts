import { randomUUID } from "node:crypto";
import { readSquareConfig, type SquareEnv } from "./config.js";
import { markCardVerified, type InviteEnv } from "../invite/service.js";

type SquarePaymentLinkResponse = {
  payment_link?: { url?: string; long_url?: string };
  errors?: { detail?: string; code?: string }[];
};

type SquarePayment = {
  id?: string;
  status?: string;
  note?: string;
  card_details?: {
    card?: {
      fingerprint?: string;
      last_4?: string;
      card_brand?: string;
    };
  };
};

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function extractCardVerifyUserId(note: unknown): string | null {
  if (typeof note !== "string") return null;
  const match = note.match(/synexus-card-verify:([0-9a-f-]{36})/i);
  return match?.[1]?.trim() || null;
}

export async function createCardVerifyCheckout(
  userId: string,
  email: string | null | undefined,
  headers: Record<string, string | string[] | undefined>,
  env: SquareEnv,
): Promise<{ statusCode: number; body: { url?: string; error?: string } }> {
  const { accessToken, locationId, apiBase, appUrl: configuredAppUrl } = readSquareConfig(env);
  if (!accessToken || !locationId) {
    return {
      statusCode: 503,
      body: { error: "Card verification is not configured. Set Square credentials on the server." },
    };
  }

  const requestOrigin = headerValue(headers.origin);
  const requestHost = headerValue(headers.host);
  const appUrl =
    requestOrigin ||
    configuredAppUrl ||
    (requestHost ? `https://${requestHost}` : "http://localhost:5173");

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
        description: "SyNexus card verification",
        quick_pay: {
          name: "SyNexus card verification",
          price_money: { amount: 100, currency: "USD" },
          location_id: locationId,
        },
        checkout_options: {
          redirect_url: `${appUrl}/invite?card=success`,
        },
        payment_note: `synexus-card-verify:${userId}`,
        pre_populated_data: email?.trim() ? { buyer_email: email.trim() } : undefined,
      }),
    });

    const data = (await response.json()) as SquarePaymentLinkResponse;
    const url = data.payment_link?.url || data.payment_link?.long_url;
    if (!response.ok || !url) {
      const detail = data.errors?.map((e) => e.detail || e.code).filter(Boolean).join("; ");
      return {
        statusCode: response.status >= 400 && response.status < 500 ? response.status : 500,
        body: { error: detail || "Could not start card verification." },
      };
    }
    return { statusCode: 200, body: { url } };
  } catch {
    return { statusCode: 500, body: { error: "Could not start card verification." } };
  }
}

export async function confirmRecentCardPayment(
  userId: string,
  env: SquareEnv & InviteEnv,
): Promise<{ ok: boolean; message: string }> {
  const { accessToken, apiBase } = readSquareConfig(env);
  if (!accessToken) {
    return { ok: false, message: "Card verification is not configured." };
  }

  const begin = new Date(Date.now() - 45 * 60 * 1000).toISOString();
  const response = await fetch(
    `${apiBase}/v2/payments?begin_time=${encodeURIComponent(begin)}&sort_order=DESC`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Square-Version": "2026-05-20",
      },
    },
  );
  const data = (await response.json()) as { payments?: SquarePayment[]; errors?: { detail?: string }[] };
  if (!response.ok) {
    return { ok: false, message: data.errors?.[0]?.detail || "Could not confirm the card yet. Wait a few seconds and retry." };
  }

  const match = (data.payments ?? []).find((payment) => {
    if (payment.status !== "COMPLETED" && payment.status !== "APPROVED") return false;
    return extractCardVerifyUserId(payment.note) === userId;
  });

  const fingerprint = match?.card_details?.card?.fingerprint || match?.id;
  if (!match || !fingerprint) {
    return {
      ok: false,
      message: "We have not seen the card charge yet. Finish Square checkout, then tap Confirm card.",
    };
  }

  return markCardVerified(
    userId,
    {
      fingerprint,
      last4: match.card_details?.card?.last_4,
      brand: match.card_details?.card?.card_brand,
    },
    env,
  );
}

export async function applyCardPaymentObject(
  object: Record<string, unknown> | undefined,
  env: InviteEnv,
): Promise<void> {
  const payment = (object?.payment ?? object) as SquarePayment | undefined;
  if (!payment) return;
  if (payment.status !== "COMPLETED" && payment.status !== "APPROVED") return;
  const userId = extractCardVerifyUserId(payment.note);
  const fingerprint = payment.card_details?.card?.fingerprint || payment.id;
  if (!userId || !fingerprint) return;
  await markCardVerified(
    userId,
    {
      fingerprint,
      last4: payment.card_details?.card?.last_4,
      brand: payment.card_details?.card?.card_brand,
    },
    env,
  );
}
