/**
 * Device-local Hera voice choice. Unset means "use the server default"
 * (OPENAI_REALTIME_VOICE), so A/B testing needs no redeploy.
 */
import { normalizeHeraVoice } from "../../config/heraVoices";

const VOICE_KEY = "synexus_hera_voice";

const listeners = new Set<(voice: string | null) => void>();

export function getHeraVoicePreference(): string | null {
  try {
    return normalizeHeraVoice(localStorage.getItem(VOICE_KEY));
  } catch {
    return null;
  }
}

export function setHeraVoicePreference(voice: string | null): void {
  const next = normalizeHeraVoice(voice);
  try {
    if (next) localStorage.setItem(VOICE_KEY, next);
    else localStorage.removeItem(VOICE_KEY);
  } catch {
    /* private mode — keep the in-memory choice for this session */
  }
  for (const listener of listeners) listener(next);
}

export function subscribeHeraVoicePreference(listener: (voice: string | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
