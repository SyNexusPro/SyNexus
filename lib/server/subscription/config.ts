import { isPaddleServerConfigured } from "./paddleEnv.js";

export type SubscriptionEnv = Record<string, string | undefined>;

export const SUBSCRIPTION_NOT_CONFIGURED_MESSAGE = "SyNexus Pro checkout is not available.";

/** True when Paddle server credentials are present (API key + webhook secret). */
export function isSubscriptionConfigured(env: SubscriptionEnv): boolean {
  return isPaddleServerConfigured(env);
}
