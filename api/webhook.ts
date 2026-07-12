/** Subscription webhooks — routes Stripe or Creem by request signature (Vercel + Vite dev). */
export {
  configureSubscriptionWebhookApi as configureWebhookApi,
  default,
  config,
} from "./subscription/webhook";

/** @deprecated Use configureWebhookApi */
export { configureSubscriptionWebhookApi as configureStripeWebhookApi } from "./subscription/webhook";
