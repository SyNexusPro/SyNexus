import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { PUBLIC_SITE_URL } from "../config/site";
import { getExternalPricingUrl, SYNEXUS_PRICING_PATH } from "../config/proPricing";

/** Google Play: digital subscriptions must not use Square checkout inside the Android app shell. */
export function androidRequiresWebSubscription(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function getWebSubscriptionUrl(): string {
  return getExternalPricingUrl() ?? `${PUBLIC_SITE_URL}${SYNEXUS_PRICING_PATH}`;
}

export const ANDROID_WEB_SUBSCRIBE_LABEL = "Subscribe on synexus.pro";

export const ANDROID_WEB_SUBSCRIBE_HINT =
  "Billing opens in your browser at synexus.pro (Google Play policy). Sign in with the same Operator account.";

export function resolveSubscribeLabel(defaultLabel: string): string {
  return androidRequiresWebSubscription() ? ANDROID_WEB_SUBSCRIBE_LABEL : defaultLabel;
}

export async function openWebSubscription(): Promise<void> {
  const url = getWebSubscriptionUrl();
  if (androidRequiresWebSubscription()) {
    await Browser.open({ url });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
