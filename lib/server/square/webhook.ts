import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { logRevenue } from "../../treasury/treasuryCore.mjs";
import { readSquareConfig, type SquareEnv } from "./config";

type PaidPlan = "PRO";

type SquareWebhookEvent = {
  merchant_id?: string;
  type?: string;
  event_id?: string;
  created_at?: string;
  data?: {
    type?: string;
    id?: string;
    object?: Record<string, unknown>;
  };
};

type WebhookEnv = SquareEnv & {
  VITE_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["ACTIVE", "PENDING"]);
const CANCELED_SUBSCRIPTION_STATUSES = new Set(["CANCELED", "DEACTIVATED"]);

function verifySquareSignature(
  rawBody: Buffer,
  signature: string | undefined,
  signatureKey: string,
  notificationUrl: string,
): boolean {
  if (!signature || !signatureKey || !notificationUrl) return false;

  const payload = notificationUrl + rawBody.toString("utf8");
  const expected = createHmac("sha256", signatureKey).update(payload).digest("base64");

  try {
    const sigBuf = Buffer.from(signature, "base64");
    const expBuf = Buffer.from(expected, "base64");
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

function extractUserIdFromNote(note: unknown): string | null {
  if (typeof note !== "string") return null;
  const match = note.match(/synexus-user:([^\s]+)/);
  const userId = match?.[1]?.trim();
  return userId && userId !== "anonymous" ? userId : null;
}

function extractUserIdFromObject(object: Record<string, unknown> | undefined): string | null {
  if (!object) return null;

  const subscription = object.subscription as Record<string, unknown> | undefined;
  if (subscription) {
    const fromNote = extractUserIdFromNote(subscription.note);
    if (fromNote) return fromNote;
  }

  const invoice = object.invoice as Record<string, unknown> | undefined;
  if (invoice) {
    const fromNote = extractUserIdFromNote(invoice.description) || extractUserIdFromNote(invoice.title);
    if (fromNote) return fromNote;
  }

  const payment = object.payment as Record<string, unknown> | undefined;
  if (payment) {
    const fromNote = extractUserIdFromNote(payment.note);
    if (fromNote) return fromNote;
  }

  return null;
}

function getSubscriptionStatus(object: Record<string, unknown> | undefined): string | null {
  const subscription = object?.subscription as Record<string, unknown> | undefined;
  const status = subscription?.status;
  return typeof status === "string" ? status : null;
}

function usdFromCents(cents: unknown): number {
  const n = typeof cents === "number" ? cents : Number(cents);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n / 100;
}

async function upsertPaidPlan(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  plan: PaidPlan | "FREE",
) {
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    paid_plan: plan,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

async function logSquareInvoicePayment(
  event: SquareWebhookEvent,
  object: Record<string, unknown> | undefined,
) {
  const invoice = object?.invoice as Record<string, unknown> | undefined;
  if (!invoice) return { logged: false, reason: "no_invoice" };

  const paymentRequests = invoice.payment_requests as
    | { computed_amount_money?: { amount?: number } }[]
    | undefined;
  const amountCents =
    paymentRequests?.[0]?.computed_amount_money?.amount ??
    (invoice.payment_requests as { total_completed_amount_money?: { amount?: number } }[] | undefined)?.[0]
      ?.total_completed_amount_money?.amount;

  const amountUsd = usdFromCents(amountCents);
  if (amountUsd <= 0) return { logged: false, reason: "zero_amount" };

  const result = await logRevenue({
    source: "pro_subs",
    amountUsd,
    note: `Square invoice ${String(invoice.id ?? "")}`,
    stripeEventId: event.event_id ?? null,
    stripeInvoiceId: typeof invoice.id === "string" ? invoice.id : null,
    stripeCustomerId:
      typeof invoice.primary_recipient === "object" && invoice.primary_recipient
        ? String((invoice.primary_recipient as { customer_id?: string }).customer_id ?? "")
        : null,
  });

  if (result.skipped) return { logged: false, skipped: true, reason: result.reason };
  return { logged: true, amountUsd: result.entry?.amountUsd };
}

export async function handleSquareWebhookRequest(
  rawBody: Buffer,
  signature: string | undefined,
  env: WebhookEnv,
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const { webhookSignatureKey, webhookNotificationUrl } = readSquareConfig(env);
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!webhookSignatureKey || !webhookNotificationUrl || !supabaseUrl || !serviceRoleKey) {
    return {
      statusCode: 500,
      body: {
        error:
          "Webhook env is missing. Set SQUARE_WEBHOOK_SIGNATURE_KEY, SQUARE_WEBHOOK_NOTIFICATION_URL, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.",
      },
    };
  }

  if (!verifySquareSignature(rawBody, signature, webhookSignatureKey, webhookNotificationUrl)) {
    return { statusCode: 401, body: { error: "Invalid Square webhook signature" } };
  }

  let event: SquareWebhookEvent;
  try {
    event = JSON.parse(rawBody.toString("utf8")) as SquareWebhookEvent;
  } catch {
    return { statusCode: 400, body: { error: "Invalid JSON payload" } };
  }

  const eventType = event.type ?? "";
  const object = event.data?.object;
  const userId = extractUserIdFromObject(object);
  const subscriptionStatus = getSubscriptionStatus(object);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (
    userId &&
    (eventType === "subscription.created" ||
      eventType === "subscription.updated" ||
      eventType === "subscription.canceled")
  ) {
    if (subscriptionStatus && ACTIVE_SUBSCRIPTION_STATUSES.has(subscriptionStatus)) {
      await upsertPaidPlan(supabase, userId, "PRO");
    } else if (subscriptionStatus && CANCELED_SUBSCRIPTION_STATUSES.has(subscriptionStatus)) {
      await upsertPaidPlan(supabase, userId, "FREE");
    }
  }

  let treasury: Awaited<ReturnType<typeof logSquareInvoicePayment>> | undefined;
  if (eventType === "invoice.payment_made") {
    try {
      treasury = await logSquareInvoicePayment(event, object);
    } catch (treasuryError) {
      console.error("[treasury]", treasuryError);
      treasury = { logged: false, reason: "treasury_error" };
    }
  }

  return {
    statusCode: 200,
    body: {
      received: true,
      type: eventType,
      eventId: event.event_id,
      treasury,
    },
  };
}
