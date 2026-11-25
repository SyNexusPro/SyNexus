import { createContext, useContext, type ReactNode } from "react";
import { useSolanaWallet } from "../hooks/useSolanaWallet";
import { buildConnectedWalletBrief } from "../lib/connectedWalletBrief";

type ConnectedWalletContextValue = ReturnType<typeof useSolanaWallet> & {
  walletBrief: string | null;
};

const ConnectedWalletContext = createContext<ConnectedWalletContextValue | null>(null);

export function ConnectedWalletProvider({ children }: { children: ReactNode }) {
  const wallet = useSolanaWallet();
  const value: ConnectedWalletContextValue = {
    ...wallet,
    walletBrief: buildConnectedWalletBrief(wallet.snapshot, wallet.kind),
  };
  return <ConnectedWalletContext.Provider value={value}>{children}</ConnectedWalletContext.Provider>;
}

export function useConnectedWallet(): ConnectedWalletContextValue {
  const ctx = useContext(ConnectedWalletContext);
  if (!ctx) {
    throw new Error("useConnectedWallet requires ConnectedWalletProvider");
  }
  return ctx;
}

/** Optional hook for surfaces that may render outside the provider. */
export function useConnectedWalletOptional(): ConnectedWalletContextValue | null {
  return useContext(ConnectedWalletContext);
}
