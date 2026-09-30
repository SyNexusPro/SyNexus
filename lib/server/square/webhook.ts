import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logRevenue } from "../../treasury/treasuryCore.mjs";
import { readSquareConfig, type SquareEnv } from "./config.js";
import { applyCardPaymentObject } from "./cardVerify.js";

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

/** Square Dashboard notification URL. HMAC input is this exact string plus the raw body. */
export const SQUARE_PRODUCTION_WEBHOOK_URL = "https://synexus.pro/api/webhook";

/**
 * Signature URL Square uses in production.
 * A www host or trailing slash would fail validation even when the key is correct.
 * Other URLs (sandbox tunnels) are kept exactly as configured.
 */
export function squareNotificationUrl(env: { SQUARE_WEBHOOK_NOTIFICATION_URL?: string }): string {
  const configured = env.SQUARE_WEBHOOK_NOTIFICATION_URL?.trim() ?? "";
  if (!configured) return SQUARE_PRODUCTION_WEBHOOK_URL;
  const stripped = configured.replace(/\/+$/, "");
  if (
    stripped === SQUARE_PRODUCTION_WEBHOOK_URL ||
    stripped === "https://www.synexus.pro/api/webhook"
  ) {
    return SQUARE_PRODUCTION_WEBHOOK_URL;
  }
  return configured;
}

/**
 * Square HMAC-SHA256 over `notificationUrl + rawBody`, compared in constant time.
 * Matches the official sample: key `asdf1234`, URL `https://example.com/webhook`,
 * body `{"hello":"world"}` → `2kRE5qRU2tR+tBGlDwMEw2avJ7QM4ikPYD/PJ3bd9Og=`.
 */
export function verifySquareWebhookSignature(
  rawBody: Buffer,
  signature: string | undefined,
  signatureKey: string,
  notificationUrl: string,
): boolean {
  const actual = signature?.trim() ?? "";
  if (!actual || !signatureKey || !notificationUrl || rawBody.length === 0) return false;

  const payload = notificationUrl + rawBody.toString("utf8");
  const expected = createHmac("sha256", signatureKey).update(payload).digest("base64");
  const actualBuf = Buffer.from(actual);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(actualBuf, expectedBuf);
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
  supabase: SupabaseClient,
  userId: string,
  plan: PaidPlan | "FREE",
) {
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    paid_plan: plan,
    subscription_status: plan === "PRO" ? "active" : "free",
    updated_at: new Date().toISOString(),
  });
  if (error) {
    // Older DBs may lack subscription_status — fall back
    const { error: fallback } = await supabase.from("profiles").upsert({
      id: userId,
      paid_plan: plan,
      updated_at: new Date().toISOString(),
    });
    if (fallback) throw fallback;
  }
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

export type SquareWebhookDecision =
  | { ok: true; event: SquareWebhookEvent }
  | { ok: false; statusCode: 400 | 403 | 503; error: string };

function webhookEventType(event: SquareWebhookEvent): string {
  return typeof event.type === "string" ? event.type : "";
}

function webhookEventId(event: SquareWebhookEvent): string {
  return typeof event.event_id === "string" ? event.event_id.trim() : "";
}

export function evaluateSquareWebhook(
  rawBody: Buffer,
  signature: string | undefined,
  env: WebhookEnv,
): SquareWebhookDecision {
  const { webhookSignatureKey } = readSquareConfig(env);
  const notificationUrl = squareNotificationUrl(env);
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!webhookSignatureKey || !supabaseUrl || !serviceRoleKey) {
    console.error(
      "[webhook] Missing env — set SQUARE_WEBHOOK_SIGNATURE_KEY, SUPABASE_URL (or VITE_SUPABASE_URL), and SUPABASE_SERVICE_ROLE_KEY.",
    );
    return { ok: false, statusCode: 503, error: "Webhook is not configured" };
  }

  if (!verifySquareWebhookSignature(rawBody, signature, webhookSignatureKey, notificationUrl)) {
    console.warn("[webhook] Invalid Square webhook signature");
    return { ok: false, statusCode: 403, error: "Invalid signature" };
  }

  let event: SquareWebhookEvent;
  try {
    event = JSON.parse(rawBody.toString("utf8")) as SquareWebhookEvent;
  } catch {
    console.warn("[webhook] Invalid JSON payload");
    return { ok: false, statusCode: 400, error: "Invalid JSON" };
  }
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    console.warn("[webhook] Invalid JSON payload");
    return { ok: false, statusCode: 400, error: "Invalid JSON" };
  }

  console.log(`[webhook] event_type=${webhookEventType(event)} event_id=${webhookEventId(event)}`);
  return { ok: true, event };
}

export function squareWebhookInsertClaim(
  error: { code?: string; message?: string } | null | undefined,
): "claimed" | "duplicate" | "unavailable" {
  if (!error) return "claimed";
  const code = error.code ?? "";
  const message = error.message ?? "";
  if (code === "23505" || /duplicate key|unique constraint/i.test(message)) {
    return "duplicate";
  }
  return "unavailable";
}

async function claimSquareEvent(
  supabase: SupabaseClient,
  eventId: string,
  eventType: string,
): Promise<"claimed" | "duplicate" | "unavailable"> {
  const { error } = await supabase.from("square_webhook_events").insert({
    event_id: eventId,
    event_type: eventType,
  });
  const claim = squareWebhookInsertClaim(error);
  if (claim === "unavailable") {
    console.error(`[webhook] idempotency store unavailable code=${error?.code ?? ""}`);
  }
  return claim;
}

export async function processAcceptedSquareEvent(
  event: SquareWebhookEvent,
  env: WebhookEnv,
): Promise<void> {
  const eventType = webhookEventType(event);
  const eventId = webhookEventId(event);
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[webhook] Missing Supabase service credentials");
    return;
  }
  if (!eventId) {
    console.warn(`[webhook] missing event_id event_type=${eventType}`);
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const claim = await claimSquareEvent(supabase, eventId, eventType);
  if (claim === "duplicate") {
    console.log(`[webhook] duplicate event_type=${eventType} event_id=${eventId}`);
    return;
  }

  try {
    const object = event.data?.object;
    const userId = extractUserIdFromObject(object);
    const subscriptionStatus = getSubscriptionStatus(object);

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

    if (eventType === "invoice.payment_made") {
      try {
        await logSquareInvoicePayment(event, object);
      } catch (treasuryError) {
        console.error("[treasury]", treasuryError);
      }
    }

    if (
      eventType === "payment.created" ||
      eventType === "payment.updated" ||
      eventType === "payment.completed"
    ) {
      try {
        await applyCardPaymentObject(object, env);
      } catch (inviteError) {
        console.error("[invite-card]", inviteError);
      }
    }
  } catch (error) {
    if (claim === "claimed") {
      await supabase.from("square_webhook_events").delete().eq("event_id", eventId);
    }
    throw error;
  }
}

export async function processSquareWebhookEvent(
  rawBody: Buffer,
  signature: string | undefined,
  env: WebhookEnv,
): Promise<void> {
  const decision = evaluateSquareWebhook(rawBody, signature, env);
  if (!decision.ok) return;
  await processAcceptedSquareEvent(decision.event, env);
}

export async function handleSquareWebhookRequest(
  rawBody: Buffer,
  signature: string | undefined,
  env: WebhookEnv,
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const decision = evaluateSquareWebhook(rawBody, signature, env);
  if (!decision.ok) {
    return { statusCode: decision.statusCode, body: { error: decision.error } };
  }
  await processAcceptedSquareEvent(decision.event, env);
  return { statusCode: 200, body: { received: true } };
}
