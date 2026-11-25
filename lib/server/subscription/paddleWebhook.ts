import { createHmac, timingSafeEqual } from "node:crypto";
import { productTier, type MembershipTier } from "../membership/policy.js";
import type { ApplyWebhookInput } from "../membership/store.js";

/** Paddle signs `ts:rawBody` with HMAC-SHA256; header form: `ts=…;h1=…`. */
const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PaddleWebhookEvent = {
  event_id?: string;
  event_type?: string;
  occurred_at?: string;
  data?: Record<string, unknown>;
};

export type MappedPaddleEvent =
  | { kind: "ignore"; reason: string }
  | { kind: "apply"; input: ApplyWebhookInput };

function trim(value: string | undefined | null): string {
  return (value ?? "").trim();
}

function parseSignatureHeader(header: string): { ts: string; h1: string } | null {
  const parts = Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const eq = part.indexOf("=");
        if (eq <= 0) return ["", ""];
        return [part.slice(0, eq), part.slice(eq + 1)];
      }),
  );
  const ts = parts.ts?.trim() ?? "";
  const h1 = parts.h1?.trim() ?? "";
  if (!ts || !h1) return null;
  return { ts, h1 };
}

export function verifyPaddleWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
  nowMs = Date.now(),
): boolean {
  const expectedSecret = trim(secret);
  const header = trim(signatureHeader);
  if (!expectedSecret || !header || !rawBody) return false;

  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;

  const tsMs = Number(parsed.ts) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs(nowMs - tsMs) > MAX_SIGNATURE_AGE_MS) return false;

  const signedPayload = `${parsed.ts}:${rawBody}`;
  const digest = createHmac("sha256", expectedSecret).update(signedPayload, "utf8").digest("hex");
  const left = Buffer.from(digest);
  const right = Buffer.from(parsed.h1);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function customData(data: Record<string, unknown> | undefined): Record<string, unknown> {
  const raw = data?.custom_data;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

function userIdFromEvent(data: Record<string, unknown> | undefined): string {
  const custom = customData(data);
  for (const key of ["user_id", "userId", "app_user_id"]) {
    const value = custom[key];
    if (typeof value === "string" && UUID.test(value.trim())) return value.trim();
  }
  return "";
}

function firstPriceId(data: Record<string, unknown> | undefined): string {
  const items = data?.items;
  if (!Array.isArray(items) || items.length === 0) return "";
  const first = items[0] as Record<string, unknown> | undefined;
  const price = first?.price as Record<string, unknown> | undefined;
  const id = typeof price?.id === "string" ? price.id : typeof first?.price_id === "string" ? first.price_id : "";
  return id.trim();
}

function envPrice(env: Record<string, string | undefined>, ...keys: string[]): string {
  for (const key of keys) {
    const value = trim(env[key]);
    if (value) return value;
  }
  return "";
}

function canonicalProductId(priceId: string, env: Record<string, string | undefined>): string | null {
  const pairs: Array<[string, string]> = [
    [envPrice(env, "PADDLE_ADVANCED_MONTH_PRICE_ID", "VITE_PADDLE_ADVANCED_MONTH_PRICE_ID", "PADDLE_PANTHEON_PRICE_ID", "VITE_PADDLE_PANTHEON_PRICE_ID"), "the_pantheon_monthly"],
    [envPrice(env, "PADDLE_ADVANCED_YEAR_PRICE_ID", "VITE_PADDLE_ADVANCED_YEAR_PRICE_ID"), "the_pantheon_annual"],
    [envPrice(env, "PADDLE_PRO_MONTH_PRICE_ID", "VITE_PADDLE_PRO_MONTH_PRICE_ID"), "pro_monthly"],
    [envPrice(env, "PADDLE_PRO_YEAR_PRICE_ID", "VITE_PADDLE_PRO_YEAR_PRICE_ID"), "pro_annual"],
    [envPrice(env, "PADDLE_STARTER_MONTH_PRICE_ID", "VITE_PADDLE_STARTER_MONTH_PRICE_ID", "PADDLE_NEXT_LEVEL_PRICE_ID", "VITE_PADDLE_NEXT_LEVEL_PRICE_ID"), "starter_monthly"],
    [envPrice(env, "PADDLE_STARTER_YEAR_PRICE_ID", "VITE_PADDLE_STARTER_YEAR_PRICE_ID"), "starter_annual"],
    [envPrice(env, "PADDLE_NEXT_LEVEL_PRICE_ID_NO_TRIAL", "VITE_PADDLE_NEXT_LEVEL_PRICE_ID_NO_TRIAL"), "starter_monthly"],
    [envPrice(env, "PADDLE_PANTHEON_PRICE_ID_NO_TRIAL", "VITE_PADDLE_PANTHEON_PRICE_ID_NO_TRIAL"), "the_pantheon_monthly"],
  ];
  for (const [id, product] of pairs) {
    if (id && id === priceId) return product;
  }

  const mapped = productTier(priceId);
  if (mapped === "pantheon") return "the_pantheon_monthly";
  if (mapped === "next_level") return "starter_monthly";
  return null;
}

function productFromSubscription(
  data: Record<string, unknown> | undefined,
  env: Record<string, string | undefined>,
): string | null {
  const priceId = firstPriceId(data);
  const fromPrice = priceId ? canonicalProductId(priceId, env) : null;
  if (fromPrice) return fromPrice;

  const custom = customData(data);
  const tier = trim(String(custom.tier ?? custom.membership_tier ?? "")).toLowerCase();
  if (tier === "advanced" || tier === "pantheon") return "the_pantheon_monthly";
  if (tier === "pro") return "pro_monthly";
  if (tier === "starter" || tier === "next_level" || tier === "basic" || tier === "nextlevel") {
    return "starter_monthly";
  }

  const productHint = trim(String(custom.product_id ?? custom.productId ?? ""));
  if (productHint && productTier(productHint)) return productHint;
  return null;
}

function membershipStatus(paddleStatus: string, eventType: string): string | null {
  const status = paddleStatus.trim().toLowerCase();
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due") return "billing_issue";
  if (status === "canceled" || status === "cancelled") return "canceled";
  if (status === "paused") return "canceled";
  if (eventType === "subscription.past_due") return "billing_issue";
  if (eventType === "subscription.canceled") return "canceled";
  return null;
}

function expiresAtFromSubscription(data: Record<string, unknown> | undefined): string | null {
  const period = data?.current_billing_period as Record<string, unknown> | undefined;
  const endsAt = typeof period?.ends_at === "string" ? period.ends_at : null;
  if (endsAt) {
    const ms = Date.parse(endsAt);
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }
  const nextBilled = typeof data?.next_billed_at === "string" ? data.next_billed_at : null;
  if (nextBilled) {
    const ms = Date.parse(nextBilled);
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }
  const scheduled = data?.scheduled_change as Record<string, unknown> | undefined;
  if (scheduled?.action === "cancel" && typeof scheduled.effective_at === "string") {
    const ms = Date.parse(scheduled.effective_at);
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }
  return null;
}

function subscriptionId(data: Record<string, unknown> | undefined): string | null {
  const id = typeof data?.id === "string" ? data.id.trim() : "";
  return id.startsWith("sub_") ? id : null;
}

function customerId(data: Record<string, unknown> | undefined): string | null {
  const id = typeof data?.customer_id === "string" ? data.customer_id.trim() : "";
  return id.startsWith("ctm_") ? id : null;
}

/** Map a verified Paddle notification into the shared membership ledger shape. */
export function mapPaddleWebhookEvent(
  event: PaddleWebhookEvent,
  env: Record<string, string | undefined>,
): MappedPaddleEvent {
  const eventType = trim(event.event_type);
  const eventId = trim(event.event_id);
  if (!eventId) return { kind: "ignore", reason: "missing_event_id" };

  const subscriptionEvents = new Set([
    "subscription.created",
    "subscription.updated",
    "subscription.activated",
    "subscription.canceled",
    "subscription.past_due",
    "subscription.paused",
    "subscription.resumed",
    "subscription.trialing",
  ]);

  if (!subscriptionEvents.has(eventType)) {
    return { kind: "ignore", reason: "unhandled_event" };
  }

  const data = event.data;
  const userId = userIdFromEvent(data);
  if (!userId) return { kind: "ignore", reason: "missing_user_id" };

  const paddleStatus = trim(String(data?.status ?? ""));
  const status = membershipStatus(paddleStatus, eventType);
  if (!status) return { kind: "ignore", reason: "unhandled_status" };

  const productId = productFromSubscription(data, env);
  if (!productId) return { kind: "ignore", reason: "unknown_product" };

  const markTrialUsed =
    paddleStatus === "trialing" ||
    eventType === "subscription.trialing" ||
    eventType === "subscription.created" ||
    eventType === "subscription.activated";

  return {
    kind: "apply",
    input: {
      eventId: `paddle:${eventId}`,
      userId,
      eventType,
      productId,
      status,
      expiresAt: expiresAtFromSubscription(data),
      markTrialUsed,
      paddleCustomerId: customerId(data),
      paddleSubscriptionId: subscriptionId(data),
      provider: "paddle",
    },
  };
}

export function resolvePaddleTier(
  priceId: string | null | undefined,
  env: Record<string, string | undefined>,
): MembershipTier | null {
  const id = trim(priceId);
  if (!id) return null;
  const product = canonicalProductId(id, env);
  return product ? productTier(product) : productTier(id);
}

export function priceIdForPlan(
  plan: "next_level" | "pantheon",
  env: Record<string, string | undefined>,
  opts: { trialEligible: boolean } = { trialEligible: true },
): string | null {
  if (plan === "pantheon") {
    const withTrial = trim(env.PADDLE_PANTHEON_PRICE_ID) || trim(env.VITE_PADDLE_PANTHEON_PRICE_ID);
    const noTrial = trim(env.PADDLE_PANTHEON_PRICE_ID_NO_TRIAL) || trim(env.VITE_PADDLE_PANTHEON_PRICE_ID_NO_TRIAL);
    if (opts.trialEligible) return withTrial || null;
    return noTrial || withTrial || null;
  }
  const withTrial = trim(env.PADDLE_NEXT_LEVEL_PRICE_ID) || trim(env.VITE_PADDLE_NEXT_LEVEL_PRICE_ID);
  const noTrial = trim(env.PADDLE_NEXT_LEVEL_PRICE_ID_NO_TRIAL) || trim(env.VITE_PADDLE_NEXT_LEVEL_PRICE_ID_NO_TRIAL);
  if (opts.trialEligible) return withTrial || null;
  return noTrial || withTrial || null;
}
