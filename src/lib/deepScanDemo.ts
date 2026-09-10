import type { Token } from "../data/tokens";
import { DEEP_SCAN_FREE_LIMIT } from "../config/deepScanDemo";
import { hasStoredOwnerGrant } from "./ownerAccess";

export const DEEP_SCAN_TOKENS_KEY = "synexus_deep_scan_tokens";
export const DEEP_SCAN_CHANGED = "synexus-deep-scan-changed";

function readScannedKeys(): string[] {
  try {
    const raw = localStorage.getItem(DEEP_SCAN_TOKENS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeScannedKeys(keys: string[]) {
  try {
    localStorage.setItem(DEEP_SCAN_TOKENS_KEY, JSON.stringify(keys.slice(0, DEEP_SCAN_FREE_LIMIT)));
  } catch {
    /* ignore */
  }
}

export function deepScanTokenKey(token: Token): string {
  return (token.mintAddress?.trim() || token.id || token.symbol).toLowerCase();
}

export function hasUnlimitedDeepScans(operatorLinked: boolean): boolean {
  return operatorLinked || hasStoredOwnerGrant();
}

export function getDeepScansUsed(): number {
  return readScannedKeys().length;
}

export function getDeepScansRemaining(operatorLinked: boolean): number {
  if (hasUnlimitedDeepScans(operatorLinked)) return DEEP_SCAN_FREE_LIMIT;
  return Math.max(0, DEEP_SCAN_FREE_LIMIT - getDeepScansUsed());
}

export function hasDeepScanAccess(operatorLinked: boolean, token?: Token): boolean {
  if (hasUnlimitedDeepScans(operatorLinked)) return true;
  const keys = readScannedKeys();
  if (token) {
    const key = deepScanTokenKey(token);
    if (keys.includes(key)) return true;
  }
  return keys.length < DEEP_SCAN_FREE_LIMIT;
}

export function recordDeepScan(token: Token, operatorLinked: boolean): void {
  if (hasUnlimitedDeepScans(operatorLinked)) return;
  const key = deepScanTokenKey(token);
  const keys = readScannedKeys();
  if (keys.includes(key)) return;
  if (keys.length >= DEEP_SCAN_FREE_LIMIT) return;
  writeScannedKeys([...keys, key]);
  window.dispatchEvent(new Event(DEEP_SCAN_CHANGED));
}

export function notifyDeepScanChanged(): void {
  window.dispatchEvent(new Event(DEEP_SCAN_CHANGED));
}
