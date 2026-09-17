import { heraRealtimeController, type HeraRealtimeEvents } from "../lib/hera/HeraRealtimeController";
import type { ConversationTurn } from "../lib/oracleSupremeConversation";

export type HeraLiveVoiceState = {
  connected: boolean;
  listening: boolean;
  userSpeaking: boolean;
  heraSpeaking: boolean;
  muted: boolean;
  transcript: string;
  error: string | null;
  amplitude: number;
};

type ConnectOpts = {
  history?: ConversationTurn[];
  seedText?: string;
  contextNote?: string;
};

/**
 * Live Hera: microphone → OpenAI Realtime (WebRTC) → streaming speaker.
 * OPENAI_API_KEY never lives here — only an ephemeral session secret from /api/hera/session.
 */
class HeraLiveVoiceService {
  connect(opts?: ConnectOpts): Promise<boolean> {
    return heraRealtimeController.connect(opts);
  }

  disconnect(): void {
    heraRealtimeController.disconnect();
  }

  /** Applies a new voice by reconnecting; no-op when Hera is not live. */
  restartSession(): Promise<boolean> {
    return heraRealtimeController.restartSession();
  }

  startListening(): void {
    heraRealtimeController.startListening();
  }

  stopListening(): void {
    heraRealtimeController.stopListening();
  }

  interrupt(): void {
    heraRealtimeController.interrupt();
  }

  setMuted(muted: boolean): void {
    heraRealtimeController.setMuted(muted);
  }

  sendText(text: string): boolean {
    return heraRealtimeController.sendText(text);
  }

  subscribe(listener: HeraRealtimeEvents): () => void {
    return heraRealtimeController.subscribe(listener);
  }

  snapshot(): HeraLiveVoiceState {
    return {
      connected: heraRealtimeController.connected,
      listening: heraRealtimeController.listening,
      userSpeaking: heraRealtimeController.isUserSpeaking(),
      heraSpeaking: heraRealtimeController.isHeraSpeaking(),
      muted: heraRealtimeController.isMuted(),
      transcript: heraRealtimeController.getTranscript(),
      error: null,
      amplitude: heraRealtimeController.getMouthOpen(),
    };
  }
}

export const heraLiveVoice = new HeraLiveVoiceService();
