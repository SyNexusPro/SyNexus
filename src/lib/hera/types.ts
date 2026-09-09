/** Shared Hera hologram / voice types — visual layer over existing Titan/Hera chat. */

export type HeraConversationState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "interrupted"
  | "error";

/** Avatar / hologram visual state — same machine as the live conversation. */
export type HeraAvatarState = HeraConversationState;

/** UI modes from the Hera design system. `hologram` kept as alias of `vision`. */
export type HeraInterfaceMode = "chat" | "voice" | "vision" | "analysis" | "hologram";

/** Expression strip: Neutral · Thinking · Analyzing · Warning */
export type HeraEmotion = "neutral" | "thinking" | "analyzing" | "warning";

/** @deprecated use HeraEmotion — mapped for older callsites */
export type HeraLegacyEmotion = "focused" | "alert" | "warm";

/** Mouth shape hint for lip-sync providers. */
export type HeraViseme =
  | "sil"
  | "aa"
  | "E"
  | "I"
  | "O"
  | "U"
  | "PP"
  | "FF"
  | "TH"
  | "DD"
  | "kk"
  | "CH"
  | "SS"
  | "nn"
  | "RR"
  | string;

export type HeraResponse = {
  id: string;
  text: string;
  startedAt: number;
  completedAt?: number;
  interrupted?: boolean;
};

export type AudioPlaybackData = {
  /** Optional blob/URL when a remote TTS provider returns audio. */
  url?: string;
  /** Approximate duration in ms when known. */
  durationMs?: number;
  /** Provider id for debugging. */
  provider: string;
  /** Spoken text (for viseme scheduling when phonemes are unavailable). */
  text?: string;
};

export type HeraAvatarRendererProps = {
  state: HeraAvatarState;
  isActive?: boolean;
  audioLevel?: number;
  viseme?: HeraViseme | null;
  emotion?: HeraEmotion;
  reducedMotion?: boolean;
  lowPerf?: boolean;
  className?: string;
};

export function normalizeHeraMode(mode: HeraInterfaceMode): Exclude<HeraInterfaceMode, "hologram"> {
  return mode === "hologram" ? "vision" : mode;
}

/** Voice and Vision are the same presence: full-screen hologram + speak. */
export function isHeraPresenceMode(mode: HeraInterfaceMode): boolean {
  const m = normalizeHeraMode(mode);
  return m === "voice" || m === "vision";
}

export function isHeraVisionMode(mode: HeraInterfaceMode): boolean {
  const m = normalizeHeraMode(mode);
  return m === "voice" || m === "vision" || m === "analysis";
}

export function isHeraVoiceCapableMode(mode: HeraInterfaceMode): boolean {
  const m = normalizeHeraMode(mode);
  return m === "voice" || m === "vision" || m === "analysis";
}

export function emotionLabel(emotion: HeraEmotion): string {
  switch (emotion) {
    case "thinking":
      return "Thinking";
    case "analyzing":
      return "Analyzing";
    case "warning":
      return "Warning";
    default:
      return "Neutral";
  }
}
