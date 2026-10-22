/**
 * Device-local "how long Hera waits when you pause" choice.
 * Unset means the default (Natural).
 */
import { HERA_DEFAULT_PATIENCE, normalizeHeraPatience, type HeraPatience } from "./endpointing";

const PATIENCE_KEY = "synexus_hera_patience";

const listeners = new Set<(patience: HeraPatience) => void>();

export function getHeraPatience(): HeraPatience {
  try {
    return normalizeHeraPatience(localStorage.getItem(PATIENCE_KEY)) ?? HERA_DEFAULT_PATIENCE;
  } catch {
    return HERA_DEFAULT_PATIENCE;
  }
}

export function setHeraPatience(patience: HeraPatience): void {
  const next = normalizeHeraPatience(patience) ?? HERA_DEFAULT_PATIENCE;
  try {
    localStorage.setItem(PATIENCE_KEY, next);
  } catch {
    /* private mode: keep the in-memory choice for this session */
  }
  for (const listener of listeners) listener(next);
}

export function subscribeHeraPatience(listener: (patience: HeraPatience) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
