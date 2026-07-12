import type Stripe from "stripe";
import { logRevenue } from "../lib/treasury/treasuryCore.mjs";

export type TreasuryLogResult = Awaited<ReturnType<typeof logRevenue>>;

function usdFromCents(cents: number | null | undefined): number {
  if (cents == null || !Number.isFinite(cents)) return 0;
  return cents / 100;
}

function isSubscriptionInvoice(invoice: Stripe.Invoice): boolean {
  if (invoice.subscription) return true;
  const reason = invoice.billing_reason ?? "";
  if (reason.startsWith("subscription")) return true;
  return invoice.lines?.data?.some((line) => line.type === "subscription") ?? false;
}

/** Subscription renewals and first paid invoice (skips $0 trial invoices). */
export async function logInvoicePayment(
  invoice: Stripe.Invoice,
  eventId: string,
): Promise<TreasuryLogResult | null> {
  const amountUsd = usdFromCents(invoice.amount_paid);
  if (amountUsd <= 0) return null;
  if (!isSubscriptionInvoice(invoice)) return null;

  return logRevenue({
    source: "pro_subs",
    amountUsd,
    note: `Stripe invoice ${invoice.id}${invoice.billing_reason ? ` (${invoice.billing_reason})` : ""}`,
    stripeEventId: eventId,
    stripeInvoiceId: invoice.id,
    stripeCustomerId: typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null,
  });
}

/** One-time checkout payments only — subscriptions are logged via invoice.payment_succeeded. */
export async function logCheckoutPayment(
  session: Stripe.Checkout.Session,
  eventId: string,
): Promise<TreasuryLogResult | null> {
  if (session.mode === "subscription") return null;

  const amountUsd = usdFromCents(session.amount_total);
  if (amountUsd <= 0) return null;

  const plan = session.metadata?.plan;
  const source = plan === "PRO" ? "pro_subs" : "other";

  return logRevenue({
    source,
    amountUsd,
    note: `Checkout session ${session.id}`,
    stripeEventId: eventId,
    stripeCustomerId:
      typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
  });
}

export async function processStripeTreasuryEvent(
  event: Stripe.Event,
): Promise<{ logged: boolean; skipped?: boolean; reason?: string; amountUsd?: number }> {
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;
    const result = await logInvoicePayment(invoice, event.id);
    if (!result) return { logged: false, reason: "zero_or_non_pro_invoice" };
    if (result.skipped) return { logged: false, skipped: true, reason: result.reason };
    return { logged: true, amountUsd: result.entry?.amountUsd };
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const result = await logCheckoutPayment(session, event.id);
    if (!result) return { logged: false, reason: "subscription_deferred_to_invoice" };
    if (result.skipped) return { logged: false, skipped: true, reason: result.reason };
    return { logged: true, amountUsd: result.entry?.amountUsd };
  }

  return { logged: false, reason: "event_ignored" };
}

export { logRevenue };
