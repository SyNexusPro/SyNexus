/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_BIRDEYE_API_KEY?: string;
  readonly VITE_SOLANA_RPC_URL?: string;
  /** Optional: Stripe Connect / Lemon Squeezy / other affiliate payout portal URL. */
  readonly VITE_AFFILIATE_PAYOUT_URL?: string;
  /** Google Analytics 4 measurement ID (e.g. G-XXXXXXXXXX). */
  readonly VITE_GA_MEASUREMENT_ID?: string;
  /** AdSense home display unit slot ID (numeric string from AdSense dashboard). */
  readonly VITE_ADSENSE_HOME_SLOT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
