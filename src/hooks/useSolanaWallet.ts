import { useCallback, useEffect, useState } from "react";
import {
  connectSolanaWallet,
  detectSolanaProviders,
  fetchWalletSnapshot,
  hasInjectedSolanaWallet,
  tryReconnectSolanaWallet,
  type SolanaWalletKind,
  type SolanaWalletProvider,
  type WalletSnapshot,
} from "../lib/solanaWallet";

export function useSolanaWallet() {
  const [available, setAvailable] = useState(() =>
    typeof window === "undefined" ? false : hasInjectedSolanaWallet(),
  );
  const [kinds, setKinds] = useState<SolanaWalletKind[]>(() =>
    typeof window === "undefined" ? [] : detectSolanaProviders().map((p) => p.kind),
  );
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
    setAddress(null);
    setKind(null);
    setProvider(null);
    setSnapshot(null);
  }, [provider]);

  useEffect(() => {
    const scan = () => {
      setAvailable(hasInjectedSolanaWallet());
      setKinds(detectSolanaProviders().map((p) => p.kind));
    };
    scan();
    const timer = window.setInterval(scan, 2500);
    return () => window.clearInterval(timer);
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
    available,
    kinds,
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
