import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversationTurn } from "../lib/oracleSupremeConversation";
import type { HeraConversationState, HeraResponse } from "../lib/hera/types";
import { heraLiveVoice } from "../services/heraVoice";
import { useAppIsActive } from "./useAppIsActive";

type Options = {
  active: boolean;
  history: ConversationTurn[];
  seedText?: string | null;
  contextNote?: string;
  onUserTurn?: (text: string) => void;
  onAssistantTurn?: (response: HeraResponse) => void;
};

/**
 * React binding for live Hera: mic → OpenAI Realtime WebRTC → speaker.
 * Face animation should read mouthOpen / state — it does not own the network.
 */
export function useHeraRealtime(options: Options) {
  const { active, history, seedText, contextNote, onUserTurn, onAssistantTurn } = options;
  const appActive = useAppIsActive();
  const live = active && appActive;
  const [state, setState] = useState<HeraConversationState>("idle");
  const [mouthOpen, setMouthOpen] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [muted, setMutedState] = useState(false);
  const historyRef = useRef(history);
  const seedRef = useRef(seedText);
  const contextRef = useRef(contextNote);
  const userTurnRef = useRef(onUserTurn);
  const assistantTurnRef = useRef(onAssistantTurn);
  historyRef.current = history;
  seedRef.current = seedText;
  contextRef.current = contextNote;
  userTurnRef.current = onUserTurn;
  assistantTurnRef.current = onAssistantTurn;

  useEffect(() => {
    return heraLiveVoice.subscribe({
      onState: setState,
      onMouthOpen: setMouthOpen,
      onUserTurn: (text) => userTurnRef.current?.(text),
      onAssistantTurn: (response) => assistantTurnRef.current?.(response),
      onError: (message) => setError(message || null),
      onUnavailable: () => {
        setUnavailable(true);
        setError(null);
        setState("idle");
      },
      onUserSpeaking: setUserSpeaking,
      onTranscript: setTranscript,
    });
  }, []);

  useEffect(() => {
    if (!live || unavailable) {
      heraLiveVoice.disconnect();
      if (!unavailable) {
        setState("idle");
        setMouthOpen(0);
        setUserSpeaking(false);
      }
      return;
    }
    const seed = seedRef.current?.trim() ?? "";
    void heraLiveVoice.connect({
      history: historyRef.current,
      seedText: seed.length >= 6 ? seed : "",
      contextNote: contextRef.current,
    });
    return () => {
      heraLiveVoice.disconnect();
    };
  }, [live, unavailable]);

  const sendText = useCallback((text: string) => {
    return heraLiveVoice.sendText(text);
  }, []);

  const interrupt = useCallback(() => {
    heraLiveVoice.interrupt();
  }, []);

  const armListening = useCallback(() => {
    heraLiveVoice.startListening();
  }, []);

  const setMuted = useCallback((next: boolean) => {
    heraLiveVoice.setMuted(next);
    setMutedState(next);
  }, []);

  const stopListening = useCallback(() => {
    heraLiveVoice.stopListening();
    setMutedState(true);
  }, []);

  const connected =
    !unavailable &&
    (state === "listening" || state === "thinking" || state === "speaking" || state === "interrupted");

  return {
    state,
    status: state,
    connected,
    unavailable,
    speaking: connected && state === "speaking",
    listening: connected && !muted && (state === "listening" || state === "interrupted"),
    thinking: !unavailable && (state === "thinking" || state === "connecting"),
    userSpeaking,
    heraSpeaking: connected && state === "speaking",
    transcript,
    muted,
    audioLevel: mouthOpen,
    mouthOpen,
    amplitude: mouthOpen,
    error: unavailable ? null : error,
    sendText,
    interrupt,
    armListening,
    setMuted,
    startListening: armListening,
    stopListening,
  };
}
