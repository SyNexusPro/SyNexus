import { useCallback, useEffect, useState } from "react";
import {
  connectSolanaWallet,
  detectSolanaProviders,
  fetchWalletSnapshot,
  forgetSolanaWallet,
  subscribeSolanaWallets,
  tryReconnectSolanaWallet,
  type SolanaWalletKind,
  type SolanaWalletProvider,
  type WalletSnapshot,
} from "../lib/solanaWallet";

export type SolanaWalletOption = { kind: SolanaWalletKind; icon?: string };

function scanWallets(): SolanaWalletOption[] {
  if (typeof window === "undefined") return [];
  return detectSolanaProviders().map(({ kind, icon }) => ({ kind, icon }));
}

function sameOptions(a: SolanaWalletOption[], b: SolanaWalletOption[]): boolean {
  return a.length === b.length && a.every((w, i) => w.kind === b[i].kind && w.icon === b[i].icon);
}

export function useSolanaWallet() {
  const [wallets, setWallets] = useState<SolanaWalletOption[]>(scanWallets);
  const [address, setAddress] = useState<string | null>(null);
  const [kind, setKind] = useState<SolanaWalletKind | null>(null);
  const [provider, setProvider] = useState<SolanaWalletProvider | null>(null);
  const [snapshot, setSnapshot] = useState<WalletSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (nextAddress?: string, nextKind?: SolanaWalletKind) => {
    const addr = nextAddress ?? address;
    const k = nextKind ?? kind;
    if (!addr || !k) return;
    try {
      const snap = await fetchWalletSnapshot(addr, k);
      setSnapshot(snap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load balances.");
    }
  }, [address, kind]);

  const connect = useCallback(async (preferred?: SolanaWalletKind) => {
    setBusy(true);
    setError(null);
    try {
      const result = await connectSolanaWallet(preferred);
      setAddress(result.address);
      setKind(result.kind);
      setProvider(result.provider);
      await refresh(result.address, result.kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection failed.");
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const disconnect = useCallback(async () => {
    try {
      await provider?.disconnect?.();
    } catch {
      /* ignore */
    }
    forgetSolanaWallet();
    setAddress(null);
    setKind(null);
    setProvider(null);
    setSnapshot(null);
  }, [provider]);

  useEffect(() => {
    const scan = () => {
      const next = scanWallets();
      setWallets((prev) => (sameOptions(prev, next) ? prev : next));
    };
    const unsubscribe = subscribeSolanaWallets(scan);
    scan();
    const timer = window.setInterval(scan, 2500);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const trusted = await tryReconnectSolanaWallet();
      if (cancelled || !trusted) return;
      setAddress(trusted.address);
      setKind(trusted.kind);
      setProvider(trusted.provider);
      try {
        const snap = await fetchWalletSnapshot(trusted.address, trusted.kind);
        if (!cancelled) setSnapshot(snap);
      } catch {
        /* balances can retry after connect */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    available: wallets.length > 0,
    wallets,
    kinds: wallets.map((w) => w.kind),
    address,
    kind,
    provider,
    snapshot,
    busy,
    error,
    connect,
    disconnect,
    refresh,
  };
}
