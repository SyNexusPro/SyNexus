/** Creem Merchant-of-Record webhooks (Vercel + Vite dev). */
export { configureCreemWebhookApi as configureWebhookApi, default, config } from "./creem/webhook";

/** @deprecated Use configureWebhookApi */
export { configureCreemWebhookApi as configureStripeWebhookApi } from "./creem/webhook";
