import type { VersionedTransaction } from "@solana/web3.js";
import type { WalletConnectWalletAdapter } from "@walletconnect/solana-adapter";
import type { SolanaWalletProvider } from "./solanaWallet";

export const WALLETCONNECT_WALLET_NAME = "WalletConnect";

export const WALLETCONNECT_ICON =
  "data:image/svg+xml;base64," +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#3B99FC"/><path fill="#fff" d="M12.2 15.6c4.3-4.2 11.3-4.2 15.6 0l.5.5c.2.2.2.6 0 .8l-1.8 1.7c-.1.1-.3.1-.4 0l-.7-.7c-3-2.9-7.9-2.9-10.9 0l-.8.8c-.1.1-.3.1-.4 0l-1.8-1.7c-.2-.2-.2-.6 0-.8l.7-.6zm19.3 3.6 1.6 1.6c.2.2.2.6 0 .8l-7.2 7c-.2.2-.6.2-.8 0l-5.1-5c-.1-.1-.1-.1-.2 0l-5.1 5c-.2.2-.6.2-.8 0l-7.2-7c-.2-.2-.2-.6 0-.8l1.6-1.6c.2-.2.6-.2.8 0l5.1 5c.1.1.1.1.2 0l5.1-5c.2-.2.6-.2.8 0l5.1 5c.1.1.1.1.2 0l5.1-5c.2-.2.6-.2.8 0z"/></svg>',
  );

export function walletConnectProjectId(): string {
  return (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "").trim();
}

export function isWalletConnectConfigured(): boolean {
  return walletConnectProjectId().length > 0;
}

let adapterPromise: Promise<WalletConnectWalletAdapter> | null = null;

async function loadAdapter(): Promise<WalletConnectWalletAdapter> {
  if (!adapterPromise) {
    adapterPromise = (async () => {
      const [{ WalletConnectWalletAdapter }, { WalletAdapterNetwork }] = await Promise.all([
        import("@walletconnect/solana-adapter"),
        import("@solana/wallet-adapter-base"),
      ]);
      const origin = window.location.origin;
      return new WalletConnectWalletAdapter({
        network: WalletAdapterNetwork.Mainnet,
        options: {
          projectId: walletConnectProjectId(),
          metadata: {
            name: "SyNexus",
            description: "SyNexus Solana intelligence and swaps",
            url: origin,
            icons: [`${origin}/synexus-symbol.png`],
          },
        },
      });
    })().catch((err) => {
      adapterPromise = null;
      throw err;
    });
  }
  return adapterPromise;
}

/** QR / deep-link bridge to any WalletConnect-compatible Solana wallet on another device or app. */
export function createWalletConnectProvider(): SolanaWalletProvider {
  let adapter: WalletConnectWalletAdapter | null = null;

  return {
    get publicKey() {
      return adapter?.publicKey ?? null;
    },
    get isConnected() {
      return Boolean(adapter?.connected);
    },
    connect: async (opts) => {
      if (opts?.onlyIfTrusted) throw new Error("WalletConnect needs an explicit tap to reconnect.");
      adapter = await loadAdapter();
      if (!adapter.connected) await adapter.connect();
      const key = adapter.publicKey;
      if (!key) throw new Error("WalletConnect did not return an account.");
      return { publicKey: key };
    },
    disconnect: async () => {
      await adapter?.disconnect();
    },
    signTransaction: async (tx: VersionedTransaction) => {
      if (!adapter?.connected) throw new Error("WalletConnect is not connected.");
      return adapter.signTransaction(tx);
    },
  };
}
