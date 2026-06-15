import type { SecurityEvent } from "./types";
import { syncRemoteSecurityEvent } from "./remoteAudit";

const LOG_KEY = "synexus_aegis_events";
const BLOCK_KEY = "synexus_aegis_blocked";
const MAX_EVENTS = 100;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota
  }
}

export function appendSecurityEvent(event: SecurityEvent, fingerprint?: string) {
  const list = readJson<SecurityEvent[]>(LOG_KEY, []);
  writeJson(LOG_KEY, [event, ...list].slice(0, MAX_EVENTS));
  if (fingerprint) syncRemoteSecurityEvent(event, fingerprint);
}

export function getRecentSecurityEvents(limit = 20): SecurityEvent[] {
  return readJson<SecurityEvent[]>(LOG_KEY, []).slice(0, limit);
}

export function isFingerprintBlocked(fingerprint: string): boolean {
  const blocked = readJson<Record<string, { until: number; reason: string }>>(BLOCK_KEY, {});
  const entry = blocked[fingerprint];
  if (!entry) return false;
  if (Date.now() > entry.until) {
    delete blocked[fingerprint];
    writeJson(BLOCK_KEY, blocked);
    return false;
  }
  return true;
}

export function blockFingerprint(fingerprint: string, reason: string, durationMs = 86_400_000) {
  const blocked = readJson<Record<string, { until: number; reason: string }>>(BLOCK_KEY, {});
  blocked[fingerprint] = { until: Date.now() + durationMs, reason };
  writeJson(BLOCK_KEY, blocked);
}

export function getDeviceFingerprint(): string {
  if (typeof window === "undefined") return "server";
  const parts = [
    navigator.userAgent?.slice(0, 80) ?? "",
    navigator.language ?? "",
    String(screen?.width ?? 0),
    String(screen?.height ?? 0),
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
  ];
  let hash = 0;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return `fp_${Math.abs(hash).toString(36)}`;
}
