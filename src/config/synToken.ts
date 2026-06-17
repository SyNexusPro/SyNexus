/** SyN / SYN community token — pump.fun launch config. */

export const SYN_MINT =
  (import.meta.env.VITE_SYN_MINT as string | undefined)?.trim() ||
  "5dAXtHS6xBEwuCQsgpwZDiqaByWdiQSvRYTsLnpf7i9u";

export const SYN_SYMBOL = "SYN";

export const SYN_TOKEN_ID = "hivemind-sol";

export const SYN_PUMPFUN_URL =
  (import.meta.env.VITE_SYN_PUMPFUN_URL as string | undefined)?.trim() ||
  `https://pump.fun/coin/${SYN_MINT}`;

export const SYN_DEXSCREENER_URL = `https://dexscreener.com/solana/${SYN_MINT}`;

export const SYN_IS_LIVE = (import.meta.env.VITE_SYN_LIVE as string | undefined)?.trim() !== "0";

const BANNER_DISMISS_KEY = "synexus_syn_launch_banner_dismissed";

export function isSynLaunchBannerDismissed(): boolean {
  try {
    return localStorage.getItem(BANNER_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissSynLaunchBanner(): void {
  try {
    localStorage.setItem(BANNER_DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}
