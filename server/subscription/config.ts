import { isSquareConfigured, type SquareEnv } from "../square/config";

export type SubscriptionEnv = SquareEnv;

export const SUBSCRIPTION_NOT_CONFIGURED_MESSAGE =
  "Synexus Pro checkout is not configured yet. Set Square credentials on the server and try again.";

export function isSubscriptionConfigured(env: SubscriptionEnv): boolean {
  return isSquareConfigured(env);
}

export function subscriptionProviderLabel(): string {
  return "Square";
}
