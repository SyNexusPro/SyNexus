import { useCallback, useEffect, useRef, useState } from "react";
import {
  createDefaultSttProvider,
  type SpeechToTextProvider,
} from "../lib/hera/voiceProviders";

export type UseHeraVoiceInputOptions = {
  provider?: SpeechToTextProvider;
  /** Called once when a listening session ends with a real transcript. */
  onFinalTranscript?: (text: string) => void;
  enabled?: boolean;
  /** Hands-free: restart the mic after idle / empty results. */
  autoRestart?: boolean;
  /** Mute capture while Hera is thinking or speaking (blocks echo). */
  muted?: boolean;
};

function isRealTranscript(text: string): boolean {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length < 2) return false;
  return /[\p{L}\p{N}]/u.test(trimmed);
}

/**
 * Speech-to-text for Hera. Empty results never become a chat turn.
 */
export function useHeraVoiceInput(options: UseHeraVoiceInputOptions = {}) {
  const providerRef = useRef(options.provider ?? createDefaultSttProvider());
  const onFinalRef = useRef(options.onFinalTranscript);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [partial, setPartial] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const enabled = options.enabled !== false;
  const autoRestart = options.autoRestart === true;
  const muted = options.muted === true;
  const sessionGen = useRef(0);
  const listeningRef = useRef(false);
  const emittedRef = useRef(false);
  const permissionDeniedRef = useRef(false);
  const mutedRef = useRef(muted);
  const autoRestartRef = useRef(autoRestart);
  const startListeningRef = useRef<() => Promise<void>>(async () => undefined);
  const [supported] = useState(() => providerRef.current.isSupported());
  mutedRef.current = muted;
  autoRestartRef.current = autoRestart;

  useEffect(() => {
    if (options.provider) providerRef.current = options.provider;
  }, [options.provider]);

  useEffect(() => {
    onFinalRef.current = options.onFinalTranscript;
  }, [options.onFinalTranscript]);

  const stopPulse = useCallback(() => {
    setAudioLevel(0);
  }, []);

  const startPulse = useCallback(() => {
    setAudioLevel(0.3);
  }, []);

  const emitFinal = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!isRealTranscript(trimmed) || emittedRef.current) return;
    emittedRef.current = true;
    console.info("[Hera listen] transcript received", trimmed);
    onFinalRef.current?.(trimmed);
  }, []);

  const abort = useCallback(() => {
    sessionGen.current += 1;
    listeningRef.current = false;
    emittedRef.current = true;
    providerRef.current.abort();
    stopPulse();
    setListening(false);
    setTranscribing(false);
    setPartial("");
  }, [stopPulse]);

  const stopListening = useCallback(async () => {
    if (!listeningRef.current) return "";
    listeningRef.current = false;
    stopPulse();
    setListening(false);
    setTranscribing(true);
    setPartial("Transcribing…");
    try {
      const text = (await providerRef.current.stopListening()).trim();
      setTranscribing(false);
      setPartial("");
      if (isRealTranscript(text)) emitFinal(text);
      return text;
    } catch (err) {
      setTranscribing(false);
      setPartial("");
      setError(err instanceof Error ? err.message : "Could not stop listening");
      return "";
    }
  }, [emitFinal, stopPulse]);

  const startListening = useCallback(async () => {
    if (!enabled || mutedRef.current || listeningRef.current || transcribing) return;
    if (permissionDeniedRef.current) return;
    if (!supported) {
      setError("Microphone is not available on this device.");
      return;
    }
    setError(null);
    setPartial("");
    emittedRef.current = false;
    const gen = ++sessionGen.current;
    listeningRef.current = true;
    setListening(true);
    startPulse();
    try {
      const text = (
        await providerRef.current.startListening((value) => {
          if (/transcrib/i.test(value)) {
            listeningRef.current = false;
            setListening(false);
            setTranscribing(true);
          }
          setPartial(value);
        })
      ).trim();
      if (sessionGen.current !== gen) return;
      listeningRef.current = false;
      stopPulse();
      setListening(false);
      setTranscribing(false);
      setPartial("");
      if (!isRealTranscript(text)) {
        console.info("[Hera listen] transcript received", { text: "" });
        return;
      }
      emitFinal(text);
    } catch (err) {
      if (sessionGen.current !== gen) return;
      listeningRef.current = false;
      stopPulse();
      setListening(false);
      setTranscribing(false);
      const message = err instanceof Error ? err.message : "Microphone unavailable";
      console.info("[Hera listen] recognition error", { error: message });
      if (/permission/i.test(message)) permissionDeniedRef.current = true;
      if (/permission|not available|No microphone/i.test(message)) {
        setError(message);
      }
    }
  }, [emitFinal, enabled, startPulse, stopPulse, supported, transcribing]);

  startListeningRef.current = startListening;

  const toggleListening = useCallback(async () => {
    if (listeningRef.current) return stopListening();
    await startListening();
    return "";
  }, [startListening, stopListening]);

  useEffect(() => {
    if (!muted) return;
    abort();
  }, [abort, muted]);

  useEffect(() => {
    if (!autoRestart || !enabled || muted) return;
    if (listening || transcribing) return;
    if (permissionDeniedRef.current) return;
    const timer = window.setTimeout(() => {
      void startListeningRef.current();
    }, 600);
    return () => window.clearTimeout(timer);
  }, [autoRestart, enabled, listening, muted, transcribing]);

  useEffect(() => {
    return () => {
      providerRef.current.abort();
      stopPulse();
    };
  }, [stopPulse]);

  return {
    supported,
    listening,
    transcribing,
    partial,
    audioLevel,
    error,
    startListening,
    stopListening,
    toggleListening,
    abort,
  };
}
