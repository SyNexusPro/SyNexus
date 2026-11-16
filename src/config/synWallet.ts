/** SyN Wallet — self-custodial Solana wallet inside SyNexus. */
export const SYN_WALLET_PATH = "/wallet";
export const SYN_WALLET_PRODUCT_NAME = "SyN Wallet";
export const SYN_WALLET_TAGLINE = "Scan. Sign. Own.";

/** Public Solana RPC — override with VITE_SOLANA_RPC_URL in production. */
export const SYN_WALLET_RPC_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SOLANA_RPC_URL?.trim()) ||
  "https://api.mainnet-beta.solana.com";

export const SYN_WALLET_DERIVATION_PATH = "m/44'/501'/0'/0'";

/** Legacy route kept for Trust/footer deep links. */
export const SYNEXUS_VAULT_PATH = SYN_WALLET_PATH;
export const SYNEXUS_VAULT_PRODUCT_NAME = SYN_WALLET_PRODUCT_NAME;
export const SYNEXUS_VAULT_STATUS = "Live — beta";
