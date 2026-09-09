/** SyN / SYN community token — Solana mint + trade links. */

/** Live SyNexus SyN mint (pump.fun bonding curve). The 8A85… address is not on mainnet. */
export const SYN_MINT =
  (import.meta.env.VITE_SYN_MINT as string | undefined)?.trim() ||
  "9naVtLAGKWYuEcGehe1BZ3DpiSLHjSNsaeFr2JPHpump";

export const SYN_SYMBOL = "SYN";

export const SYN_TOKEN_ID = "syn-sol";

/** pump.fun coin page for the live SyN mint. */
export const SYN_PUMPFUN_URL = `https://pump.fun/coin/${SYN_MINT}`;

/** Jupiter swap URL (buy SYN with SOL). */
export const SYN_JUPITER_URL = `https://jup.ag/swap/SOL-${SYN_MINT}`;

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
