import {
  DEFAULT_TITAN_BOT_NAME,
  TITAN_BOT_NAME_MAX_LEN,
  TITAN_BOT_NAME_MIN_LEN,
} from "../config/titanBot";

export const TITAN_BOT_NAME_STORAGE_KEY = "synexus_titan_bot_name";
export const TITAN_BOT_NAME_CHANGED = "synexus-titan-bot-name-changed";

export function normalizeTitanBotName(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed.length < TITAN_BOT_NAME_MIN_LEN || trimmed.length > TITAN_BOT_NAME_MAX_LEN) return null;
  if (!/^[\p{L}\p{N}][\p{L}\p{N} .'-]*[\p{L}\p{N}]$|^[\p{L}\p{N}]$/u.test(trimmed)) return null;
  return trimmed;
}

export function readStoredTitanBotName(): string | null {
  try {
    const raw = localStorage.getItem(TITAN_BOT_NAME_STORAGE_KEY)?.trim();
    if (!raw) return null;
    return normalizeTitanBotName(raw) ?? null;
  } catch {
    return null;
  }
}

export function resolveTitanBotName(stored?: string | null): string {
  const candidate = stored ?? readStoredTitanBotName();
  return candidate ?? DEFAULT_TITAN_BOT_NAME;
}

export function saveTitanBotName(name: string): string {
  const normalized = normalizeTitanBotName(name) ?? DEFAULT_TITAN_BOT_NAME;
  try {
    localStorage.setItem(TITAN_BOT_NAME_STORAGE_KEY, normalized);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(TITAN_BOT_NAME_CHANGED));
  return normalized;
}

export function resetTitanBotName(): string {
  try {
    localStorage.removeItem(TITAN_BOT_NAME_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(TITAN_BOT_NAME_CHANGED));
  return DEFAULT_TITAN_BOT_NAME;
}

/** Replace legacy commander labels in generated copy. */
export function applyTitanBotNameToText(text: string, titanName = resolveTitanBotName()): string {
  return text
    .replace(/Oracle Supreme/g, titanName)
    .replace(/\bOracle('s|s)\b/g, (_, suffix) => `${titanName}${suffix ?? ""}`)
    .replace(/\bOracle\b/g, titanName);
}
