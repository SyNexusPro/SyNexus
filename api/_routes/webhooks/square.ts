import {
  config,
  handleSubscriptionWebhook,
} from "../subscription/webhook.js";

export const SQUARE_LIVE_WEBHOOK_URL = "https://synexus.pro/api/webhooks/square";

export default function handler(
  req: Parameters<typeof handleSubscriptionWebhook>[0],
  res: Parameters<typeof handleSubscriptionWebhook>[1],
) {
  return handleSubscriptionWebhook(req, res, {
    ...process.env,
    SQUARE_WEBHOOK_SIGNATURE_KEY:
      process.env.SQUARE_LIVE_WEBHOOK_SIGNATURE_KEY ||
      process.env.SQUARE_WEBHOOK_SIGNATURE_KEY,
    SQUARE_WEBHOOK_NOTIFICATION_URL:
      process.env.SQUARE_LIVE_WEBHOOK_NOTIFICATION_URL || SQUARE_LIVE_WEBHOOK_URL,
  });
}

export { config };
