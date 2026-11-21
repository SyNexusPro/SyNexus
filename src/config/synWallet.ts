import { resolveSolanaCluster } from "./solanaCluster";

/** SyN Wallet — self-custodial Solana wallet inside SyNexus. */
export const SYN_WALLET_PATH = "/wallet";
export const SYN_WALLET_PRODUCT_NAME = "SyN Wallet";
export const SYN_WALLET_TAGLINE = "Scan. Sign. Own.";

const clusterChoice = resolveSolanaCluster(
  typeof import.meta !== "undefined" ? import.meta.env?.VITE_SOLANA_CLUSTER : undefined,
  typeof import.meta !== "undefined" ? import.meta.env?.VITE_SOLANA_RPC_URL : undefined,
);

/** Public Solana RPC. Mainnet unless a testing build sets VITE_SOLANA_CLUSTER=devnet. */
export const SOLANA_CLUSTER = clusterChoice.cluster;
export const SYN_WALLET_RPC_URL = clusterChoice.rpc;

export const SYN_WALLET_DERIVATION_PATH = "m/44'/501'/0'/0'";

/** Legacy route kept for Trust/footer deep links. */
export const SYNEXUS_VAULT_PATH = SYN_WALLET_PATH;
export const SYNEXUS_VAULT_PRODUCT_NAME = SYN_WALLET_PRODUCT_NAME;
export const SYNEXUS_VAULT_STATUS = "Live — beta";
