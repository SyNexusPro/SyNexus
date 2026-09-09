import { useCallback, useEffect, useState } from "react";
import { heraVoice } from "../lib/hera/HeraVoice";
import type { HeraViseme } from "../lib/hera/types";
import { setTitanVoiceEnabled, warmTitanVoices } from "../lib/titanVoice";

export type UseHeraVoiceOutputOptions = {
  /** When true, enable Titan voice preference so browser fallback can play. */
  ensureEnabled?: boolean;
};

/**
 * Streaming Hera voice. Visemes come from the shared AudioContext clock, not playback volume.
 */
export function useHeraVoiceOutput(options: UseHeraVoiceOutputOptions = {}) {
  const [speaking, setSpeaking] = useState(() => heraVoice.isSpeaking());
  const [error, setError] = useState<string | null>(null);
  const ensureEnabled = options.ensureEnabled !== false;

  useEffect(() => {
    if (ensureEnabled) {
      setTitanVoiceEnabled(true);
      warmTitanVoices();
    }
  }, [ensureEnabled]);

  useEffect(() => {
    return heraVoice.subscribe({
      onSpeaking: setSpeaking,
      onError: setError,
    });
  }, []);

  const stop = useCallback(() => {
    heraVoice.stop();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setError(null);
      if (ensureEnabled) setTitanVoiceEnabled(true);
      await heraVoice.unlock();
      await heraVoice.speak(trimmed);
    },
    [ensureEnabled],
  );

  return {
    speaking,
    audioLevel: 0,
    viseme: null as HeraViseme | null,
    error,
    speak,
    stop,
  };
}
