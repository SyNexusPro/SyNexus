export type SubscriptionEnv = Record<string, string | undefined>;

export const SUBSCRIPTION_NOT_CONFIGURED_MESSAGE = "SyNexus Pro checkout is not available.";

export function isSubscriptionConfigured(_env: SubscriptionEnv): boolean {
  return false;
}
