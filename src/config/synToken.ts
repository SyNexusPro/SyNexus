/** SyN / SYN community token — Solana mint + trade links. */

export const SYN_MINT =
  (import.meta.env.VITE_SYN_MINT as string | undefined)?.trim() ||
  "8A85yBddPdbESwoRBZVnWJiAqRaK1Qyfa1txNPjiNray";

export const SYN_SYMBOL = "SYN";

export const SYN_TOKEN_ID = "syn-sol";

/** DexScreener pair / token page for SYN. */
export const SYN_DEXSCREENER_URL = `https://dexscreener.com/solana/${SYN_MINT}`;

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
