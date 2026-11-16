import { Keypair } from "@solana/web3.js";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { derivePath } from "ed25519-hd-key";
import bs58 from "bs58";
import { SYN_WALLET_DERIVATION_PATH } from "../../config/synWallet";

export function createMnemonic(strength: 128 | 256 = 128): string {
  return generateMnemonic(wordlist, strength);
}

export function isValidMnemonic(phrase: string): boolean {
  return validateMnemonic(normalizeMnemonic(phrase), wordlist);
}

export function normalizeMnemonic(phrase: string): string {
  return phrase.trim().toLowerCase().replace(/\s+/g, " ");
}

export function keypairFromMnemonic(phrase: string, path = SYN_WALLET_DERIVATION_PATH): Keypair {
  const mnemonic = normalizeMnemonic(phrase);
  if (!validateMnemonic(mnemonic, wordlist)) {
    throw new Error("Invalid recovery phrase.");
  }
  const seed = mnemonicToSeedSync(mnemonic);
  const seedHex = Array.from(seed, (b) => b.toString(16).padStart(2, "0")).join("");
  const { key } = derivePath(path, seedHex);
  return Keypair.fromSeed(key);
}

export function keypairFromSecretBase58(secret: string): Keypair {
  const bytes = bs58.decode(secret.trim());
  if (bytes.length === 64) return Keypair.fromSecretKey(bytes);
  if (bytes.length === 32) return Keypair.fromSeed(bytes);
  throw new Error("Invalid secret key.");
}

export function secretKeyBase58(keypair: Keypair): string {
  return bs58.encode(keypair.secretKey);
}

export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}
