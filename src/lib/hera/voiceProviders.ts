/**
 * Swappable STT/TTS adapters for Hera voice mode.
 * Browser fallbacks ship now; Whisper / ElevenLabs / OpenAI can plug in later.
 */

import type { AudioPlaybackData } from "./types";
import { monitorStreamLevel, type AudioLevelMonitor } from "./audioAnalysis";
import { heraVoice } from "./HeraVoice";
import { getHeraWakePermission, requestMicrophoneAccess } from "./wakeWord";
import {
  hasTitanVoiceEnabled,
  isTitanVoiceSupported,
  speakTitan,
  stopTitanSpeech,
  textForTitanSpeech,
} from "../titanVoice";

export type SpeakOptions = {
  onStart?: () => void;
  onBoundary?: (word: string) => void;
};

export interface TextToSpeechProvider {
  readonly id: string;
  speak(text: string, options?: SpeakOptions): Promise<AudioPlaybackData>;
  stop(): void;
  isSpeaking(): boolean;
}

export interface SpeechToTextProvider {
  readonly id: string;
  /** Starts listening; resolves with final transcript when the session ends. */
  startListening(onPartial?: (text: string) => void): Promise<string>;
  /** Forces the active session to stop (resolves the pending startListening promise). */
  stopListening(): Promise<string>;
  abort(): void;
  isSupported(): boolean;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onnomatch: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Browser speechSynthesis — wraps existing Titan/Hera voice persona. */
export class BrowserTextToSpeechProvider implements TextToSpeechProvider {
  readonly id = "browser-speechSynthesis";

  private speaking = false;

  async speak(text: string, options?: SpeakOptions): Promise<AudioPlaybackData> {
    const spoken = textForTitanSpeech(text);
    if (!spoken || !isTitanVoiceSupported() || !hasTitanVoiceEnabled()) {
      this.speaking = false;
      return { provider: this.id, durationMs: 0 };
    }

    return new Promise((resolve, reject) => {
      this.speaking = true;
      speakTitan(spoken, {
        onStart: () => {
          this.speaking = true;
          options?.onStart?.();
        },
        onEnd: () => {
          this.speaking = false;
          resolve({
            provider: this.id,
            text: spoken,
            durationMs: Math.min(12_000, Math.max(800, spoken.length * 55)),
          });
        },
        onError: () => {
          this.speaking = false;
          reject(new Error("Browser TTS failed"));
        },
        onBoundary: options?.onBoundary,
      });
    });
  }

  stop(): void {
    this.speaking = false;
    stopTitanSpeech();
  }

  isSpeaking(): boolean {
    return this.speaking;
  }
}

/**
 * Future: ElevenLabs / OpenAI TTS via `/api/hera/tts` (keys stay server-side).
 */
export class RemoteApiTextToSpeechProvider implements TextToSpeechProvider {
  readonly id = "remote-api-tts";
  private speaking = false;
  private objectUrl: string | null = null;

  async speak(text: string, _options?: SpeakOptions): Promise<AudioPlaybackData> {
    const spoken = textForTitanSpeech(text);
    if (!spoken) return { provider: this.id, durationMs: 0, text: "" };

    this.stop();
    this.speaking = true;
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 4000);
      const res = await fetch("/api/hera/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: spoken }),
        signal: controller.signal,
      });
      window.clearTimeout(timer);
      if (res.status === 501 || !res.ok) {
        this.speaking = false;
        throw new Error("Remote TTS unavailable");
      }
      const blob = await res.blob();
      this.objectUrl = URL.createObjectURL(blob);
      return {
        provider: this.id,
        url: this.objectUrl,
        text: spoken,
        durationMs: Math.min(14_000, Math.max(900, spoken.length * 55)),
      };
    } catch (err) {
      this.speaking = false;
      throw err;
    }
  }

  stop(): void {
    this.speaking = false;
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  isSpeaking(): boolean {
    return this.speaking;
  }
}

/** Alias kept for older imports — same remote API TTS provider. */
export { RemoteApiTextToSpeechProvider as PlaceholderRemoteTextToSpeechProvider };

/**
 * Tries remote TTS for accurate lip-sync audio; falls back to browser speechSynthesis.
 */
export class HybridTextToSpeechProvider implements TextToSpeechProvider {
  readonly id = "hybrid-tts";
  private remote = new RemoteApiTextToSpeechProvider();
  private browser = new BrowserTextToSpeechProvider();
  private active: TextToSpeechProvider = this.browser;
  private remoteUnavailable = false;

  async speak(text: string, options?: SpeakOptions): Promise<AudioPlaybackData> {
    if (!this.remoteUnavailable) {
      try {
        const remote = await this.remote.speak(text, options);
        if (remote.url) {
          this.active = this.remote;
          return remote;
        }
      } catch {
        this.remoteUnavailable = true;
      }
    }
    this.active = this.browser;
    return this.browser.speak(text, options);
  }

  stop(): void {
    this.remote.stop();
    this.browser.stop();
  }

  isSpeaking(): boolean {
    return this.active.isSpeaking();
  }
}

function heraListenLog(event: string, detail?: unknown): void {
  if (detail !== undefined) console.info(`[Hera listen] ${event}`, detail);
  else console.info(`[Hera listen] ${event}`);
}

function isRealTranscript(text: string): boolean {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length < 2) return false;
  return /[\p{L}\p{N}]/u.test(trimmed);
}

const UTTERANCE_PAUSE_MS = 1400;
const RESTART_DELAY_MS = 220;

/** Web Speech API STT — continuous listen; only settles on a real transcript. */
export class BrowserSpeechToTextProvider implements SpeechToTextProvider {
  readonly id = "browser-web-speech";

  private recognition: SpeechRecognitionLike | null = null;
  private finalText = "";
  private interimText = "";
  private partialHandler: ((text: string) => void) | null = null;
  private endResolver: ((text: string) => void) | null = null;
  private endRejecter: ((err: Error) => void) | null = null;
  private utteranceTimer = 0;
  private restartTimer = 0;
  private wanted = false;
  private committing = false;
  private fatal = false;
  private engineGen = 0;
  private booting = false;

  isSupported(): boolean {
    return Boolean(getSpeechRecognitionCtor());
  }

  async startListening(onPartial?: (text: string) => void): Promise<string> {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) throw new Error("Speech recognition is not supported in this browser.");

    const permission =
      getHeraWakePermission() === "granted" ? "granted" : await requestMicrophoneAccess();
    if (permission !== "granted") {
      heraListenLog("recognition error", { error: "not-allowed" });
      throw new Error("Microphone permission is needed to speak with Hera.");
    }

    this.abort();
    this.wanted = true;
    this.fatal = false;
    this.committing = false;
    this.finalText = "";
    this.interimText = "";
    this.partialHandler = onPartial ?? null;

    return new Promise<string>((resolve, reject) => {
      this.endResolver = resolve;
      this.endRejecter = reject;
      this.bootEngine(Ctor);
    });
  }

  private bootEngine(Ctor: SpeechRecognitionCtor): void {
    if (!this.wanted || this.fatal) return;
    const gen = this.engineGen;
    this.booting = true;
    const previous = this.recognition;
    this.recognition = null;
    try {
      previous?.abort();
    } catch {
      /* ignore */
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      if (gen !== this.engineGen || !this.wanted || this.fatal) return;
      if (heraVoice.isSpeaking()) {
        this.finalText = "";
        this.interimText = "";
        return;
      }
      let interim = "";
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalChunk += transcript;
        else interim += transcript;
      }
      if (finalChunk) this.finalText = `${this.finalText} ${finalChunk}`.trim();
      this.interimText = interim.trim();
      const display = (this.finalText || this.interimText).trim();
      if (display) {
        heraListenLog("transcript received", display);
        this.partialHandler?.(display);
      }
      if (isRealTranscript(display)) this.armUtteranceCommit(Ctor);
      else this.clearUtteranceTimer();
    };

    recognition.onerror = (event) => {
      const code = event.error ?? "";
      heraListenLog("recognition error", { error: code });
      if (code === "no-speech" || code === "aborted" || code === "nomatch") return;
      if (code === "not-allowed" || code === "service-not-allowed") {
        this.fatal = true;
        this.settle(new Error("Microphone permission is needed to speak with Hera."));
        return;
      }
      if (code === "audio-capture") {
        this.fatal = true;
        this.settle(new Error("No microphone found."));
      }
    };

    recognition.onnomatch = () => {
      heraListenLog("recognition error", { error: "nomatch" });
    };

    recognition.onend = () => {
      if (gen !== this.engineGen || this.booting) return;
      if (this.recognition && this.recognition !== recognition) return;
      heraListenLog("recognition ended");
      this.recognition = null;
      if (!this.wanted || this.fatal) return;
      if (this.committing) {
        this.finishCommit();
        return;
      }
      heraListenLog("recognition restarted");
      this.scheduleRestart(Ctor);
    };

    this.recognition = recognition;
    try {
      recognition.start();
      heraListenLog("microphone started");
    } catch {
      heraListenLog("recognition restarted");
      this.booting = false;
      this.scheduleRestart(Ctor);
      return;
    }
    this.booting = false;
  }

  private spoken(): string {
    return (this.finalText || this.interimText).replace(/\s+/g, " ").trim();
  }

  private armUtteranceCommit(Ctor: SpeechRecognitionCtor): void {
    this.clearUtteranceTimer();
    this.utteranceTimer = window.setTimeout(() => {
      if (!this.wanted || heraVoice.isSpeaking()) return;
      const text = this.spoken();
      if (!isRealTranscript(text)) {
        this.scheduleRestart(Ctor);
        return;
      }
      this.committing = true;
      try {
        this.recognition?.stop();
      } catch {
        this.finishCommit();
      }
    }, UTTERANCE_PAUSE_MS);
  }

  private finishCommit(): void {
    const text = this.spoken();
    this.committing = false;
    if (isRealTranscript(text) && !heraVoice.isSpeaking()) {
      heraListenLog("transcript received", text);
      this.settle(undefined, text);
      return;
    }
    this.finalText = "";
    this.interimText = "";
    const Ctor = getSpeechRecognitionCtor();
    if (Ctor && this.wanted) this.scheduleRestart(Ctor);
  }

  private scheduleRestart(Ctor: SpeechRecognitionCtor): void {
    window.clearTimeout(this.restartTimer);
    this.restartTimer = window.setTimeout(() => {
      if (!this.wanted || this.fatal || this.committing) return;
      this.bootEngine(Ctor);
    }, RESTART_DELAY_MS);
  }

  private clearUtteranceTimer(): void {
    window.clearTimeout(this.utteranceTimer);
    this.utteranceTimer = 0;
  }

  private clearSession(resolveEmpty: boolean): void {
    this.wanted = false;
    this.committing = false;
    this.clearUtteranceTimer();
    window.clearTimeout(this.restartTimer);
    this.restartTimer = 0;
    try {
      this.recognition?.abort();
    } catch {
      /* ignore */
    }
    this.recognition = null;
    if (resolveEmpty) {
      const resolver = this.endResolver;
      this.endResolver = null;
      this.endRejecter = null;
      resolver?.("");
    }
  }

  private settle(err?: Error, text?: string): void {
    this.wanted = false;
    this.committing = false;
    this.clearUtteranceTimer();
    window.clearTimeout(this.restartTimer);
    this.restartTimer = 0;
    this.recognition = null;
    const resolve = this.endResolver;
    const reject = this.endRejecter;
    this.endResolver = null;
    this.endRejecter = null;
    if (err) reject?.(err);
    else resolve?.(text ?? this.spoken());
  }

  async stopListening(): Promise<string> {
    const text = this.spoken();
    this.committing = true;
    this.clearUtteranceTimer();
    try {
      this.recognition?.stop();
    } catch {
      this.settle(undefined, isRealTranscript(text) ? text : "");
    }
    return text;
  }

  abort(): void {
    this.engineGen += 1;
    this.fatal = false;
    this.clearSession(true);
  }
}

function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac", "audio/ogg"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function recorderSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

async function transcribeBlob(blob: Blob, mimeType: string): Promise<string> {
  const audioBase64 = await blobToBase64(blob);
  const res = await fetch("/api/hera/stt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audioBase64, mimeType }),
  });
  const json = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!res.ok) {
    throw new Error(json.error || "Couldn't transcribe that. Tap and speak again.");
  }
  const text = typeof json.text === "string" ? json.text.trim() : "";
  return text;
}

/**
 * Records the mic, then transcribes with Whisper / gpt-4o-transcribe.
 * Works in Android WebView where the browser Speech API often does not.
 */
export class MediaRecorderSpeechToTextProvider implements SpeechToTextProvider {
  readonly id = "media-recorder-whisper";

  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private mimeType = "audio/webm";
  private endResolver: ((text: string) => void) | null = null;
  private endRejecter: ((err: Error) => void) | null = null;
  private partialHandler: ((text: string) => void) | null = null;
  private autoStopTimer = 0;
  private startedAt = 0;
  private vadMonitor: AudioLevelMonitor | null = null;
  private vadRaf = 0;
  private stopInFlight: Promise<string> | null = null;

  isSupported(): boolean {
    return recorderSupported();
  }

  async startListening(onPartial?: (text: string) => void): Promise<string> {
    this.abort();
    this.chunks = [];
    this.partialHandler = onPartial ?? null;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
      video: false,
    }).catch((err: unknown) => {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        throw new Error("Microphone permission is needed to speak with Hera.");
      }
      if (name === "NotFoundError") {
        throw new Error("No microphone found.");
      }
      throw new Error("Could not open the microphone.");
    });
    this.stream = stream;

    const mime = pickRecorderMime();
    this.mimeType = mime || "audio/webm";
    const recorder = mime
      ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 128_000 })
      : new MediaRecorder(stream);
    this.recorder = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) this.chunks.push(event.data);
    };

    return new Promise<string>((resolve, reject) => {
      this.endResolver = resolve;
      this.endRejecter = reject;
      recorder.onerror = () => {
        this.finishWithError(new Error("Microphone recording failed."));
      };
      try {
        recorder.start(200);
      } catch {
        try {
          recorder.start();
        } catch (err) {
          this.finishWithError(err instanceof Error ? err : new Error("Could not start the microphone."));
          return;
        }
      }
      this.startedAt = Date.now();
      this.startVoiceEndDetector(stream);
      this.autoStopTimer = window.setTimeout(() => {
        void this.stopListening();
      }, 20_000);
    });
  }

  private startVoiceEndDetector(stream: MediaStream): void {
    this.stopVoiceEndDetector();
    const monitor = monitorStreamLevel(stream);
    this.vadMonitor = monitor;
    let heardSpeech = false;
    let speechMs = 0;
    let silenceMs = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(80, now - last);
      last = now;
      const level = monitor.getLevel();
      if (level >= 0.11) {
        speechMs += dt;
        silenceMs = 0;
        if (speechMs >= 160) heardSpeech = true;
      } else if (level < 0.07) {
        silenceMs += dt;
      } else {
        silenceMs = Math.max(0, silenceMs - dt * 0.4);
      }
      if (heardSpeech && silenceMs >= 1100) {
        void this.stopListening();
        return;
      }
      this.vadRaf = requestAnimationFrame(tick);
    };
    this.vadRaf = requestAnimationFrame(tick);
  }

  private stopVoiceEndDetector(): void {
    cancelAnimationFrame(this.vadRaf);
    this.vadRaf = 0;
    this.vadMonitor?.stop();
    this.vadMonitor = null;
  }

  async stopListening(): Promise<string> {
    if (this.stopInFlight) return this.stopInFlight;

    this.stopInFlight = (async () => {
      const recorder = this.recorder;
      if (!recorder || recorder.state === "inactive") {
        this.stopVoiceEndDetector();
        return this.transcribeChunks();
      }
      window.clearTimeout(this.autoStopTimer);
      this.autoStopTimer = 0;
      this.stopVoiceEndDetector();

      const elapsed = Date.now() - this.startedAt;
      if (elapsed < 240) {
        await new Promise((r) => window.setTimeout(r, 240 - elapsed));
      }

      return new Promise<string>((resolve, reject) => {
        const previousResolve = this.endResolver;
        const previousReject = this.endRejecter;
        this.endResolver = (text) => {
          previousResolve?.(text);
          resolve(text);
        };
        this.endRejecter = (err) => {
          previousReject?.(err);
          reject(err);
        };
        recorder.onstop = () => {
          void this.finishRecording();
        };
        try {
          recorder.requestData();
          recorder.stop();
        } catch {
          void this.finishRecording();
        }
      });
    })().finally(() => {
      this.stopInFlight = null;
    });

    return this.stopInFlight;
  }

  abort(): void {
    window.clearTimeout(this.autoStopTimer);
    this.autoStopTimer = 0;
    this.stopInFlight = null;
    this.stopVoiceEndDetector();
    const resolver = this.endResolver;
    this.endResolver = null;
    this.endRejecter = null;
    if (this.recorder) {
      this.recorder.ondataavailable = null;
      this.recorder.onerror = null;
      this.recorder.onstop = null;
      try {
        if (this.recorder.state !== "inactive") this.recorder.stop();
      } catch {
        /* ignore */
      }
    }
    this.releaseStream();
    this.recorder = null;
    this.chunks = [];
    resolver?.("");
  }

  private async finishRecording(): Promise<void> {
    this.partialHandler?.("Transcribing…");
    try {
      const text = await this.transcribeChunks();
      const resolve = this.endResolver;
      this.endResolver = null;
      this.endRejecter = null;
      this.releaseStream();
      this.recorder = null;
      resolve?.(text);
    } catch (err) {
      this.finishWithError(err instanceof Error ? err : new Error("Couldn't transcribe that."));
    }
  }

  private finishWithError(err: Error): void {
    const reject = this.endRejecter;
    this.endResolver = null;
    this.endRejecter = null;
    this.releaseStream();
    this.recorder = null;
    reject?.(err);
  }

  private async transcribeChunks(): Promise<string> {
    const blob = new Blob(this.chunks, { type: this.mimeType || "audio/webm" });
    this.chunks = [];
    if (blob.size < 400) {
      return "";
    }
    try {
      return await transcribeBlob(blob, this.mimeType || blob.type || "audio/webm");
    } catch {
      return "";
    }
  }

  private releaseStream(): void {
    if (!this.stream) return;
    for (const track of this.stream.getTracks()) track.stop();
    this.stream = null;
  }
}

/** Alias kept for older imports. */
export { MediaRecorderSpeechToTextProvider as PlaceholderRemoteSpeechToTextProvider };

export function createDefaultTtsProvider(): TextToSpeechProvider {
  return new HybridTextToSpeechProvider();
}

export class PreferLiveSpeechToTextProvider implements SpeechToTextProvider {
  readonly id = "prefer-live-stt";
  private live = new BrowserSpeechToTextProvider();
  private recorder = new MediaRecorderSpeechToTextProvider();
  private active: SpeechToTextProvider;
  private liveBroken = false;

  constructor() {
    this.active = this.live.isSupported() ? this.live : this.recorder;
  }

  isSupported(): boolean {
    return this.live.isSupported() || this.recorder.isSupported();
  }

  async startListening(onPartial?: (text: string) => void): Promise<string> {
    if (!this.liveBroken && this.live.isSupported()) {
      try {
        this.active = this.live;
        return await this.live.startListening(onPartial);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (!/permission|not supported|Could not start|No microphone/i.test(msg)) throw err;
        this.liveBroken = true;
      }
    }
    if (!this.recorder.isSupported()) throw new Error("Microphone is not available on this device.");
    this.active = this.recorder;
    return this.recorder.startListening(onPartial);
  }

  stopListening(): Promise<string> {
    return this.active.stopListening();
  }

  abort(): void {
    this.live.abort();
    this.recorder.abort();
  }
}

export function createDefaultSttProvider(): SpeechToTextProvider {
  return new PreferLiveSpeechToTextProvider();
}
