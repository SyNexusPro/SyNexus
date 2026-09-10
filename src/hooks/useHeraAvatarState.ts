import { useMemo } from "react";
import type { HeraAvatarState, HeraEmotion, HeraViseme } from "../lib/hera/types";

export type UseHeraAvatarStateInput = {
  /** Sheet / hologram panel open. */
  isActive: boolean;
  listening?: boolean;
  thinking?: boolean;
  speaking?: boolean;
  /** Optional manual override (same machine as the live conversation). */
  forceState?: HeraAvatarState | null;
  /** Manual expression override (Neutral / Thinking / Analyzing / Warning). */
  forceEmotion?: HeraEmotion | null;
  emotion?: HeraEmotion;
  viseme?: HeraViseme | null;
  /** 0–1 outgoing speech amplitude. Never invent a speaking loop. */
  audioLevel?: number;
  /** Analysis mode biases expression toward analyzing. */
  analysisMode?: boolean;
};

export type UseHeraAvatarStateResult = {
  state: HeraAvatarState;
  isActive: boolean;
  audioLevel: number;
  viseme: HeraViseme | null;
  emotion: HeraEmotion;
  statusLabel: string;
};

function deriveState(input: UseHeraAvatarStateInput): HeraAvatarState {
  if (input.forceState) return input.forceState;
  if (!input.isActive) return "idle";
  if (input.speaking) return "speaking";
  if (input.thinking) return "thinking";
  if (input.listening) return "listening";
  return "idle";
}

function deriveEmotion(state: HeraAvatarState, input: UseHeraAvatarStateInput): HeraEmotion {
  if (input.forceEmotion) return input.forceEmotion;
  if (input.emotion) return input.emotion;
  if (input.analysisMode && (state === "thinking" || state === "idle" || state === "connecting")) return "analyzing";
  switch (state) {
    case "listening":
    case "interrupted":
      return "neutral";
    case "thinking":
    case "connecting":
    case "speaking":
    case "error":
      return "neutral";
    default:
      return input.analysisMode ? "analyzing" : "neutral";
  }
}

function labelFor(state: HeraAvatarState, emotion: HeraEmotion, botName: string): string {
  if (emotion === "warning" && state === "error") return "Connection issue";
  if (emotion === "warning") return "Warning";
  switch (state) {
    case "connecting":
      return "Connecting…";
    case "listening":
    case "interrupted":
      return "Listening…";
    case "thinking":
      return emotion === "analyzing" ? "Analyzing…" : "Thinking…";
    case "speaking":
      return `${botName} speaking`;
    case "error":
      return "Connection issue";
    default:
      return emotion === "analyzing" ? "Analysis ready" : "Online";
  }
}

/**
 * Maps Hera chat + voice flags → hologram visual state + expression.
 * Live Hera screen should pass forceState from the realtime controller.
 */
export function useHeraAvatarState(
  input: UseHeraAvatarStateInput,
  botName = "Hera",
): UseHeraAvatarStateResult {
  const state = deriveState(input);
  const emotion = deriveEmotion(state, input);
  const audioLevel = typeof input.audioLevel === "number" ? Math.max(0, Math.min(1, input.audioLevel)) : 0;

  return useMemo(
    () => ({
      state,
      isActive: input.isActive,
      audioLevel,
      viseme: input.viseme ?? null,
      emotion,
      statusLabel: labelFor(state, emotion, botName),
    }),
    [audioLevel, botName, emotion, input.isActive, input.viseme, state],
  );
}
