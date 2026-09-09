import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversationTurn } from "../lib/oracleSupremeConversation";
import type { HeraConversationState, HeraResponse } from "../lib/hera/types";
import { heraRealtimeController } from "../lib/hera/HeraRealtimeController";

type Options = {
  active: boolean;
  history: ConversationTurn[];
  seedText?: string | null;
  contextNote?: string;
  onUserTurn?: (text: string) => void;
  onAssistantTurn?: (response: HeraResponse) => void;
};

/**
 * React binding for the single Hera realtime controller.
 * Face animation should read mouthOpen / state — it does not own the network.
 */
export function useHeraRealtime(options: Options) {
  const { active, history, seedText, contextNote, onUserTurn, onAssistantTurn } = options;
  const [state, setState] = useState<HeraConversationState>("idle");
  const [mouthOpen, setMouthOpen] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
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
    return heraRealtimeController.subscribe({
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
    });
  }, []);

  useEffect(() => {
    if (!active || unavailable) {
      heraRealtimeController.stop();
      if (!unavailable) {
        setState("idle");
        setMouthOpen(0);
      }
      return;
    }
    const seed = seedRef.current?.trim() ?? "";
    void heraRealtimeController.start({
      history: historyRef.current,
      seedText: seed.length >= 6 ? seed : "",
      contextNote: contextRef.current,
    });
    return () => {
      heraRealtimeController.stop();
    };
  }, [active, unavailable]);

  const sendText = useCallback((text: string) => {
    heraRealtimeController.sendText(text);
  }, []);

  const interrupt = useCallback(() => {
    heraRealtimeController.interrupt();
  }, []);

  const armListening = useCallback(() => {
    heraRealtimeController.armListening();
  }, []);

  const connected = !unavailable && (state === "listening" || state === "thinking" || state === "speaking" || state === "interrupted");

  return {
    state,
    status: state,
    connected,
    unavailable,
    speaking: connected && state === "speaking",
    listening: connected && (state === "listening" || state === "interrupted"),
    thinking: !unavailable && (state === "thinking" || state === "connecting"),
    audioLevel: mouthOpen,
    mouthOpen,
    error: unavailable ? null : error,
    sendText,
    interrupt,
    armListening,
  };
}
