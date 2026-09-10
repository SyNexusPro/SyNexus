import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Keypair } from "@solana/web3.js";
import {
  createMnemonic,
  isValidMnemonic,
  keypairFromMnemonic,
  keypairFromSecretBase58,
  secretKeyBase58,
} from "../lib/synWallet/crypto";
import {
  destroyWalletVault,
  hasWalletVault,
  readWalletMeta,
  saveWalletVault,
  unlockWalletVault,
  type SynWalletMeta,
} from "../lib/synWallet/vault";

type SynWalletContextValue = {
  ready: boolean;
  hasVault: boolean;
  meta: SynWalletMeta | null;
  unlocked: boolean;
  keypair: Keypair | null;
  publicKey: string | null;
  createWallet: (pin: string) => Promise<{ mnemonic: string; publicKey: string }>;
  importWallet: (mnemonic: string, pin: string) => Promise<string>;
  unlock: (pin: string) => Promise<void>;
  lock: () => void;
  wipe: () => Promise<void>;
};

const SynWalletContext = createContext<SynWalletContextValue | null>(null);

export function SynWalletProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [hasVault, setHasVault] = useState(false);
  const [meta, setMeta] = useState<SynWalletMeta | null>(null);
  const [keypair, setKeypair] = useState<Keypair | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [exists, storedMeta] = await Promise.all([hasWalletVault(), readWalletMeta()]);
      if (cancelled) return;
      setHasVault(exists);
      setMeta(storedMeta);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const createWallet = useCallback(async (pin: string) => {
    const mnemonic = createMnemonic(128);
    const kp = keypairFromMnemonic(mnemonic);
    const publicKey = kp.publicKey.toBase58();
    const nextMeta: SynWalletMeta = {
      publicKey,
      createdAt: Date.now(),
      label: "Primary",
    };
    await saveWalletVault(
      pin,
      { mnemonic, secretKeyBase58: secretKeyBase58(kp) },
      nextMeta,
    );
    setHasVault(true);
    setMeta(nextMeta);
    setKeypair(kp);
    return { mnemonic, publicKey };
  }, []);

  const importWallet = useCallback(async (mnemonic: string, pin: string) => {
    if (!isValidMnemonic(mnemonic)) throw new Error("Invalid recovery phrase.");
    const kp = keypairFromMnemonic(mnemonic);
    const publicKey = kp.publicKey.toBase58();
    const nextMeta: SynWalletMeta = {
      publicKey,
      createdAt: Date.now(),
      label: "Imported",
    };
    await saveWalletVault(
      pin,
      { mnemonic: mnemonic.trim().toLowerCase().replace(/\s+/g, " "), secretKeyBase58: secretKeyBase58(kp) },
      nextMeta,
    );
    setHasVault(true);
    setMeta(nextMeta);
    setKeypair(kp);
    return publicKey;
  }, []);

  const unlock = useCallback(async (pin: string) => {
    const { secrets, meta: unlockedMeta } = await unlockWalletVault(pin);
    const kp = secrets.mnemonic
      ? keypairFromMnemonic(secrets.mnemonic)
      : keypairFromSecretBase58(secrets.secretKeyBase58);
    setMeta(unlockedMeta);
    setHasVault(true);
    setKeypair(kp);
  }, []);

  const lock = useCallback(() => {
    setKeypair(null);
  }, []);

  const wipe = useCallback(async () => {
    await destroyWalletVault();
    setKeypair(null);
    setMeta(null);
    setHasVault(false);
  }, []);

  const value = useMemo<SynWalletContextValue>(
    () => ({
      ready,
      hasVault,
      meta,
      unlocked: Boolean(keypair),
      keypair,
      publicKey: keypair?.publicKey.toBase58() ?? meta?.publicKey ?? null,
      createWallet,
      importWallet,
      unlock,
      lock,
      wipe,
    }),
    [ready, hasVault, meta, keypair, createWallet, importWallet, unlock, lock, wipe],
  );

  return <SynWalletContext.Provider value={value}>{children}</SynWalletContext.Provider>;
}

export function useSynWallet(): SynWalletContextValue {
  const ctx = useContext(SynWalletContext);
  if (!ctx) throw new Error("useSynWallet must be used inside SynWalletProvider");
  return ctx;
}
