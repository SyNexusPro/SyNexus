import { Capacitor } from "@capacitor/core";
import {
  HERA_WAKE_CHANGED_EVENT,
  HERA_WAKE_CONSENT_EVENT,
  HERA_WAKE_CONSENT_KEY,
  HERA_WAKE_ENABLED_KEY,
  HERA_LISTEN_DOCKED_KEY,
} from "../../config/heraWakeWord";
import { openTitanChat } from "../openOracleLogin";

export type HeraWakePermission = "unknown" | "granted" | "denied" | "unsupported";

export const HERA_WAKE_PERMISSION_EVENT = "synexus-hera-wake-permission";

let permissionState: HeraWakePermission = "unknown";

export function getHeraWakePermission(): HeraWakePermission {
  return permissionState;
}

export function setHeraWakePermission(next: HeraWakePermission): void {
  if (permissionState === next) return;
  permissionState = next;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(HERA_WAKE_PERMISSION_EVENT));
  }
}

export type HeraWakeLaunch = {
  remainder: string;
  at: number;
};

export type WakeMatch = {
  hit: boolean;
  remainder: string;
};

/** Spoken names plus common speech-to-text mishearings. */
const WAKE_NAME_RE =
  "hera|hara|harah|heera|heira|hira|haira|titan|tighten|tyton|titen|tytan|titan";

const WAKE_TOKEN = new RegExp(
  `(?:(?:hey|hi|ok|okay|yo)\\s+)?(?:${WAKE_NAME_RE})\\b[,.!?]?`,
  "i",
);

function normalizeWakeTranscript(transcript: string): string {
  return transcript
    .replace(/[\u00a0\u200b]/g, " ")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/\btight\s*(?:en|in|n)\b/g, "titan")
    .replace(/\btie\s*tan\b/g, "titan")
    .replace(/\bty\s*tan\b/g, "titan")
    .replace(/\bhey\s*ra\b/g, "hera")
    .replace(/\bhay\s*ra\b/g, "hera")
    .replace(/\bher\s*a\b/g, "hera")
    .replace(/\bhair\s*a\b/g, "hera")
    .replace(/\bha\s*ra\b/g, "hera")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

let pendingLaunch: HeraWakeLaunch | null = null;
let consentDialogWanted = false;

export function isHeraWakeConsentOpen(): boolean {
  return consentDialogWanted;
}

export function openHeraWakeConsent(): void {
  consentDialogWanted = true;
  window.dispatchEvent(new Event(HERA_WAKE_CONSENT_EVENT));
}

export function closeHeraWakeConsent(): void {
  consentDialogWanted = false;
  window.dispatchEvent(new Event(HERA_WAKE_CONSENT_EVENT));
}

export function isWakeOnlyUtterance(transcript: string): boolean {
  const stripped = stripWakePrefix(transcript);
  if (!stripped) return true;
  const text = normalizeWakeTranscript(stripped);
  if (!text) return true;
  return new RegExp(`^(?:(?:hey|hi|ok|okay|yo)\\s+)?(?:${WAKE_NAME_RE})$`, "i").test(text);
}

/** Drop a leading “Hera” / “Titan” so the question is what the brain actually answers. */
export function stripWakePrefix(transcript: string): string {
  const original = transcript.replace(/\s+/g, " ").trim();
  if (!original) return "";
  const stripped = original.replace(
    /^(?:(?:hey|hi|ok|okay|yo)\s+)?(?:hera|hara|harah|heera|heira|hira|haira|titan|tighten|tyton|titen|tytan)\b[,.!? ]*/i,
    "",
  ).trim();
  return stripped;
}

export function matchWakePhrase(transcript: string): WakeMatch {
  const original = transcript.replace(/\s+/g, " ").trim();
  if (!original) return { hit: false, remainder: "" };
  const text = normalizeWakeTranscript(original);
  if (!text) return { hit: false, remainder: "" };
  const found = text.match(WAKE_TOKEN);
  if (!found || found.index == null) return { hit: false, remainder: "" };
  const remainder = text
    .slice(found.index + found[0].length)
    .trim()
    .replace(/^(?:hey|hi|ok|okay|yo)\s+/i, "")
    .trim();
  return { hit: true, remainder };
}

export function hasHeraWakeConsent(): boolean {
  try {
    return localStorage.getItem(HERA_WAKE_CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setHeraWakeConsent(on: boolean): void {
  try {
    localStorage.setItem(HERA_WAKE_CONSENT_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function isHeraListenDocked(): boolean {
  try {
    return localStorage.getItem(HERA_LISTEN_DOCKED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dockHeraListenToSettings(): void {
  try {
    if (localStorage.getItem(HERA_LISTEN_DOCKED_KEY) === "1") return;
    localStorage.setItem(HERA_LISTEN_DOCKED_KEY, "1");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(HERA_WAKE_CHANGED_EVENT));
}

export function isHeraWakeEnabled(): boolean {
  try {
    return localStorage.getItem(HERA_WAKE_ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setHeraWakeEnabled(on: boolean): void {
  try {
    localStorage.setItem(HERA_WAKE_ENABLED_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (on) dockHeraListenToSettings();
  window.dispatchEvent(new Event(HERA_WAKE_CHANGED_EVENT));
}

export function notifyHeraWakeChanged(): void {
  window.dispatchEvent(new Event(HERA_WAKE_CHANGED_EVENT));
}

export function armHeraWakeLaunch(remainder = ""): void {
  pendingLaunch = { remainder: remainder.trim(), at: Date.now() };
}

export function consumeHeraWakeLaunch(): HeraWakeLaunch | null {
  const next = pendingLaunch;
  pendingLaunch = null;
  return next;
}

export function peekHeraWakeLaunch(): HeraWakeLaunch | null {
  return pendingLaunch;
}

export function isNativeAndroidWakeEngine(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function probeMicrophonePermission(): Promise<HeraWakePermission> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "unsupported";
  }
  try {
    const perms = navigator.permissions;
    if (perms?.query) {
      const status = await perms.query({ name: "microphone" as PermissionName });
      if (status.state === "granted") return "granted";
      if (status.state === "denied") return "denied";
    }
  } catch {
    /* Permissions API may not expose microphone */
  }
  return "unknown";
}

export async function requestMicrophoneAccess(): Promise<HeraWakePermission> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "unsupported";
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return "granted";
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
      return "denied";
    }
    if (name === "NotFoundError") return "unsupported";
    return "denied";
  }
}

/** Opens Hera from a detected wake word. Remainder is the question after “Hera”. */
export function launchHeraFromWake(remainder = ""): void {
  armHeraWakeLaunch(remainder);
  openTitanChat();
}

/** Home/tool cards: turn on Listen instead of opening Hera. */
export function enableHeraWakeWordFromUi(): void {
  if (!hasHeraWakeConsent()) {
    openHeraWakeConsent();
    return;
  }
  setHeraWakeEnabled(true);
}
