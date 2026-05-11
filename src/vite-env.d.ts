/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_BIRDEYE_API_KEY?: string;
  readonly VITE_SOLANA_RPC_URL?: string;
  /** Optional: Stripe Connect / Lemon Squeezy / other affiliate payout portal URL. */
  readonly VITE_AFFILIATE_PAYOUT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
