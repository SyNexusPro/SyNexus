/** Google AdSense publisher ID — must match index.html loader script. */
export const ADSENSE_CLIENT_ID = "ca-pub-5445908527891284";

/** Home page display ad unit slot (AdSense → Ads → By ad unit). */
export const ADSENSE_HOME_SLOT =
  (import.meta.env.VITE_ADSENSE_HOME_SLOT as string | undefined)?.trim() || "";

export function isAdSenseConfigured(slot = ADSENSE_HOME_SLOT): boolean {
  return ADSENSE_CLIENT_ID.length > 0 && slot.length > 0;
}
