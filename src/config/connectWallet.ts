/** Public Connect Wallet route — external Solana wallets only (no private keys). */
export const CONNECT_WALLET_PATH = "/wallet";

export const CONNECT_WALLET_LABEL = "Connect Wallet";

/** Owner/dev-only path for the preserved SyN Wallet (not public). */
export const SYN_WALLET_DEV_PATH = "/dev/syn-wallet";

/** Public connect path is WalletConnect only (any compatible Solana wallet). */
export const CONNECT_WALLET_SUPPORTED = ["WalletConnect"] as const;
