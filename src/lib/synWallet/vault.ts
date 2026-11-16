/**
 * PIN-encrypted SyN Wallet vault.
 * Native: ciphertext in Secure Storage (Keystore/Keychain).
 * Web: ciphertext in localStorage — still encrypted; prefer the mobile app for production keys.
 */
import { Capacitor } from "@capacitor/core";
import { SecureStoragePlugin } from "capacitor-secure-storage-plugin";
import { Preferences } from "@capacitor/preferences";

const STORAGE_KEY = "syn_wallet_vault_v1";
const META_KEY = "syn_wallet_meta_v1";

export type SynWalletMeta = {
  publicKey: string;
  createdAt: number;
  label: string;
};

export type SynWalletSecrets = {
  mnemonic?: string;
  secretKeyBase58: string;
};

type StoredBlob = {
  v: 1;
  salt: string;
  iv: string;
  ciphertext: string;
  meta: SynWalletMeta;
};

function b64FromBytes(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
  return btoa(s);
}

function bytesFromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 210_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function writeRaw(value: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await SecureStoragePlugin.set({ key: STORAGE_KEY, value });
    return;
  }
  localStorage.setItem(STORAGE_KEY, value);
}

async function readRaw(): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { value } = await SecureStoragePlugin.get({ key: STORAGE_KEY });
      return value || null;
    } catch {
      return null;
    }
  }
  return localStorage.getItem(STORAGE_KEY);
}

async function removeRaw(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await SecureStoragePlugin.remove({ key: STORAGE_KEY });
    } catch {
      /* ignore */
    }
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
}

async function writeMeta(meta: SynWalletMeta | null): Promise<void> {
  const value = meta ? JSON.stringify(meta) : "";
  if (Capacitor.isNativePlatform()) {
    if (meta) await Preferences.set({ key: META_KEY, value });
    else await Preferences.remove({ key: META_KEY });
    return;
  }
  if (meta) localStorage.setItem(META_KEY, value);
  else localStorage.removeItem(META_KEY);
}

export async function readWalletMeta(): Promise<SynWalletMeta | null> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { value } = await Preferences.get({ key: META_KEY });
      if (!value) return null;
      return JSON.parse(value) as SynWalletMeta;
    }
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SynWalletMeta;
  } catch {
    return null;
  }
}

export async function hasWalletVault(): Promise<boolean> {
  const meta = await readWalletMeta();
  if (meta?.publicKey) return true;
  const raw = await readRaw();
  return Boolean(raw);
}

export async function saveWalletVault(
  pin: string,
  secrets: SynWalletSecrets,
  meta: SynWalletMeta,
): Promise<void> {
  if (pin.length < 6) throw new Error("PIN must be at least 6 digits.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const payload = new TextEncoder().encode(JSON.stringify(secrets));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, payload);
  const blob: StoredBlob = {
    v: 1,
    salt: b64FromBytes(salt),
    iv: b64FromBytes(iv),
    ciphertext: b64FromBytes(ciphertext),
    meta,
  };
  await writeRaw(JSON.stringify(blob));
  await writeMeta(meta);
}

export async function unlockWalletVault(pin: string): Promise<{ secrets: SynWalletSecrets; meta: SynWalletMeta }> {
  const raw = await readRaw();
  if (!raw) throw new Error("No SyN Wallet found on this device.");
  const blob = JSON.parse(raw) as StoredBlob;
  if (blob.v !== 1) throw new Error("Unsupported wallet vault version.");
  const key = await deriveKey(pin, bytesFromB64(blob.salt));
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytesFromB64(blob.iv) },
      key,
      bytesFromB64(blob.ciphertext),
    );
    const secrets = JSON.parse(new TextDecoder().decode(plain)) as SynWalletSecrets;
    return { secrets, meta: blob.meta };
  } catch {
    throw new Error("Wrong PIN.");
  }
}

export async function destroyWalletVault(): Promise<void> {
  await removeRaw();
  await writeMeta(null);
}
