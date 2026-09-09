import type { ConversationTurn } from "../oracleSupremeConversation";
import type { HeraConversationState, HeraResponse } from "./types";
import { heraFaceController } from "./HeraFaceController";
import { rmsFromTimeDomain } from "./audioAnalysis";
import { fetchHeraLaunchWatch, fetchHeraLiveToken } from "./liveIntel";
import { hostTimeZone } from "./formatLiveStamp";
import { SYN_MINT, SYN_SYMBOL } from "../../config/synToken";

function heraLog(message: string, extra?: unknown): void {
  if (extra !== undefined) console.info(`[HERA] ${message}`, extra);
  else console.info(`[HERA] ${message}`);
}

function heraError(message: string, extra?: unknown): void {
  if (extra !== undefined) console.error(`[HERA] ${message}`, extra);
  else console.error(`[HERA] ${message}`);
}

export type HeraRealtimeEvents = {
  onState?: (state: HeraConversationState) => void;
  onMouthOpen?: (amount: number) => void;
  onUserTurn?: (text: string) => void;
  onAssistantTurn?: (response: HeraResponse) => void;
  onError?: (message: string) => void;
  onUnavailable?: () => void;
};

type TokenPayload = {
  value?: string;
  client_secret?: { value?: string };
  model?: string;
  error?: string;
};

type RealtimeEvent = {
  type?: string;
  event_id?: string;
  response_id?: string;
  delta?: string;
  transcript?: string;
  text?: string;
  response?: {
    id?: string;
    output?: Array<{ content?: Array<{ transcript?: string; text?: string }> }>;
  };
  error?: { message?: string } | string;
};

type StartOpts = {
  history?: ConversationTurn[];
  seedText?: string;
  contextNote?: string;
};

function extractToken(json: TokenPayload): string {
  return json.value?.trim() || json.client_secret?.value?.trim() || "";
}

function isFatalSessionError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /not configured|501|401|incorrect api key|invalid_api_key/i.test(message);
}

function isMicPermissionError(err: unknown): boolean {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
  const message = err instanceof Error ? err.message : String(err);
  return name === "NotAllowedError" || name === "NotFoundError" || /permission|not allowed|denied/i.test(message);
}

function eventText(data: RealtimeEvent): string {
  return (data.transcript || data.text || data.delta || "").trim();
}

function newId(): string {
  return `hera_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Single owner of Hera's live conversation: mic, WebRTC, audio out, state, transcripts.
 * Face rendering stays separate and only reads state + mouth amplitude.
 */
export class HeraRealtimeController {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private mic: MediaStream | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private analyser: AnalyserNode | null = null;
  private analyserData: Uint8Array | null = null;
  private audioCtx: AudioContext | null = null;
  private levelRaf = 0;
  private generation = 0;
  private enabled = false;
  private connecting = false;
  private reconnectTimer = 0;
  private reconnectAttempts = 0;
  private state: HeraConversationState = "idle";
  private mouthOpen = 0;
  private lastUiLevelAt = 0;
  private userPartial = "";
  private activeResponse: HeraResponse | null = null;
  private committedResponseIds = new Set<string>();
  private listeners = new Set<HeraRealtimeEvents>();
  private pendingHistory: ConversationTurn[] = [];
  private pendingSeed = "";
  private pendingContext = "";
  private outputLive = false;
  private audioUnlocked = false;

  get conversationState(): HeraConversationState {
    return this.state;
  }

  getMouthOpen(): number {
    return this.mouthOpen;
  }

  subscribe(listener: HeraRealtimeEvents): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Start (or keep) the live session. Safe to call from wake-word later. */
  async start(opts?: StartOpts): Promise<boolean> {
    this.enabled = true;
    this.pendingHistory = opts?.history ?? this.pendingHistory;
    this.pendingSeed = opts?.seedText?.trim() || this.pendingSeed;
    this.pendingContext = opts?.contextNote?.trim() || this.pendingContext;
    if (this.dc?.readyState === "open" && this.pc) {
      heraLog("realtime connected");
      if (this.state === "idle" || this.state === "connecting" || this.state === "error") {
        this.setState("listening");
      }
      return true;
    }
    if (this.connecting) return false;
    return this.openCall();
  }

  /** Wake-word / UI activation: enter LISTENING without minting a new session. */
  armListening(): void {
    this.enabled = true;
    if (this.dc?.readyState === "open") {
      this.setState("listening");
      return;
    }
    void this.start();
  }

  stop(): void {
    this.enabled = false;
    this.cleanup("idle");
  }

  interrupt(): void {
    if (this.state !== "speaking" && !this.outputLive) return;
    heraLog("assistant interrupted");
    this.outputLive = false;
    this.muteRemote(true);
    this.finishResponse(true);
    this.send({ type: "response.cancel" });
    this.send({ type: "output_audio_buffer.clear" });
    this.setState("interrupted");
    this.setMouth(0);
    window.setTimeout(() => {
      if (this.enabled && this.state === "interrupted") this.setState("listening");
    }, 120);
  }

  sendText(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    heraLog("user speech ended", trimmed);
    this.emit("onUserTurn", trimmed);
    this.send({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: trimmed }],
      },
    });
    this.send({ type: "response.create" });
  }

  private async openCall(): Promise<boolean> {
    const gen = ++this.generation;
    this.connecting = true;
    this.setState("connecting");
    heraLog("realtime connecting");
    await this.unlockAudio();
    try {
      const tokenRes = await fetch("/api/hera/session", { method: "POST" }).catch(() => null);
      const fallback = tokenRes?.ok ? tokenRes : await fetch("/api/hera/realtime-session", { method: "POST" });
      const tokenJson = (await fallback.json()) as TokenPayload;
      if (!fallback.ok) throw new Error(tokenJson.error || `session HTTP ${fallback.status}`);
      const ephemeral = extractToken(tokenJson);
      if (!ephemeral) throw new Error("no ephemeral client secret");
      if (this.generation !== gen) return false;

      heraLog("microphone requested");
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });
      if (this.generation !== gen) {
        for (const track of mic.getTracks()) track.stop();
        return false;
      }
      this.mic = mic;
      const micTrack = mic.getAudioTracks()[0];
      heraLog("microphone active", micTrack?.label || micTrack?.id);
      micTrack?.addEventListener("ended", () => heraError("microphone track ended"));
      micTrack?.addEventListener("mute", () => heraError("microphone track muted"));

      const pc = new RTCPeerConnection();
      this.pc = pc;
      pc.addEventListener("connectionstatechange", () => {
        heraLog("realtime connectionState", pc.connectionState);
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          heraError("WebRTC connection", pc.connectionState);
          this.scheduleReconnect();
        }
      });
      pc.addEventListener("iceconnectionstatechange", () => {
        if (pc.iceConnectionState === "failed") {
          heraError("ICE failed");
          this.scheduleReconnect();
        }
      });
      if (micTrack) pc.addTrack(micTrack, mic);

      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioEl.setAttribute("playsinline", "true");
      audioEl.setAttribute("webkit-playsinline", "true");
      audioEl.style.display = "none";
      document.body.appendChild(audioEl);
      this.audioEl = audioEl;
      pc.addEventListener("track", (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        audioEl.srcObject = stream;
        heraLog("audio playback started");
        void audioEl.play().catch((err) => heraError("audio.play", err));
        this.attachOutgoingAnalyser(stream);
      });

      const dc = pc.createDataChannel("oai-events");
      this.dc = dc;
      dc.addEventListener("open", () => {
        heraLog("realtime connected");
        this.connecting = false;
        this.reconnectAttempts = 0;
        this.emit("onError", "");
        this.setState("listening");
        void this.primeConversation();
      });
      dc.addEventListener("close", () => heraError("data channel closed"));
      dc.addEventListener("error", (event) => heraError("data channel", event));
      dc.addEventListener("message", (event) => this.onServerEvent(event.data));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const answerSdp = await this.exchangeSdp(ephemeral, offer.sdp ?? "", tokenJson.model);
      if (this.generation !== gen) return false;
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      window.setTimeout(() => {
        if (this.generation === gen && this.state === "connecting") {
          heraError("data channel timeout");
          this.scheduleReconnect();
        }
      }, 12000);
      return true;
    } catch (err) {
      heraError("connection failure", err);
      this.connecting = false;
      if (isMicPermissionError(err) || isFatalSessionError(err)) {
        this.failPermanent();
        return false;
      }
      this.scheduleReconnect();
      return false;
    }
  }

  private async unlockAudio(): Promise<void> {
    if (this.audioUnlocked) return;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      if (ctx.state === "suspended") await ctx.resume();
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start();
      await ctx.close();
      this.audioUnlocked = true;
    } catch (err) {
      heraError("audio unlock", err);
    }
  }

  private async exchangeSdp(ephemeral: string, offerSdp: string, model?: string): Promise<string> {
    const headers = {
      Authorization: `Bearer ${ephemeral}`,
      "Content-Type": "application/sdp",
    };
    const ga = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      body: offerSdp,
      headers,
    });
    if (ga.ok) return ga.text();
    const gaText = await ga.text();
    heraError("SDP /calls failed", `${ga.status} ${gaText.slice(0, 160)}`);
    const modelQs = encodeURIComponent(model || "gpt-realtime");
    const legacy = await fetch(`https://api.openai.com/v1/realtime?model=${modelQs}`, {
      method: "POST",
      body: offerSdp,
      headers,
    });
    if (!legacy.ok) {
      const body = await legacy.text();
      throw new Error(`SDP exchange failed (${ga.status}/${legacy.status}) ${body.slice(0, 160)}`);
    }
    return legacy.text();
  }

  private async primeConversation(): Promise<void> {
    let context = this.pendingContext;
    try {
      const live = await fetchHeraLiveToken({ mint: SYN_MINT, symbol: SYN_SYMBOL, tz: hostTimeZone() });
      if (live?.ok) {
        const bits = [live.symbol || SYN_SYMBOL, live.source, ...(live.live ?? []).slice(0, 6)].filter(Boolean);
        context = `${context ? `${context} ` : ""}Live ${SYN_SYMBOL} snapshot: ${bits.join(" · ")}.`;
      }
    } catch (err) {
      heraError("live context skipped", err);
    }
    try {
      const launches = await fetchHeraLaunchWatch({ tz: hostTimeZone() });
      if (launches?.ok && launches.brief) {
        context = `${context ? `${context} ` : ""}LIVE LAUNCH WATCH: ${launches.brief.slice(0, 1800)}`;
      } else if (launches?.leads?.length) {
        const bits = launches.leads
          .slice(0, 6)
          .map((lead) => `${lead.symbol || lead.title} (${lead.source}, ${lead.ageMin}m)`)
          .join("; ");
        context = `${context ? `${context} ` : ""}LIVE LAUNCH WATCH: ${bits}.`;
      }
    } catch (err) {
      heraError("launch watch skipped", err);
    }
    if (context) {
      this.send({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: `Session context (do not read aloud unless asked): ${context}` }],
        },
      });
    }
    for (const turn of this.pendingHistory.filter((item) => item.text.trim()).slice(-10)) {
      this.send({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: turn.role === "oracle" ? "assistant" : "user",
          content: [
            turn.role === "oracle" ? { type: "text", text: turn.text } : { type: "input_text", text: turn.text },
          ],
        },
      });
    }
    const seed = this.pendingSeed;
    this.pendingSeed = "";
    if (seed.length >= 6) {
      this.sendText(seed);
    }
  }

  private onServerEvent(raw: unknown): void {
    if (typeof raw !== "string") return;
    let data: RealtimeEvent = {};
    try {
      data = JSON.parse(raw) as RealtimeEvent;
    } catch {
      heraError("non-JSON realtime event");
      return;
    }
    const type = data.type ?? "";

    if (type === "error") {
      const message = typeof data.error === "string" ? data.error : data.error?.message || "Realtime error";
      heraError(message, data);
      this.emit("onError", message);
      return;
    }

    if (type === "input_audio_buffer.speech_started") {
      heraLog("user speech started");
      if (this.state === "speaking" || this.outputLive) this.interrupt();
      else this.setState("listening");
      return;
    }

    if (type === "input_audio_buffer.speech_stopped") {
      heraLog("user speech ended");
      this.setState("thinking");
      return;
    }

    if (type === "response.created") {
      const id = data.response?.id || data.response_id || newId();
      this.activeResponse = { id, text: "", startedAt: Date.now() };
      heraLog("assistant response started", id);
      return;
    }

    if (type === "output_audio_buffer.started" || type === "response.output_audio.delta" || type === "response.audio.delta") {
      if (!this.activeResponse) this.activeResponse = { id: newId(), text: "", startedAt: Date.now() };
      this.outputLive = true;
      this.muteRemote(false);
      this.setState("speaking");
      return;
    }

    if (type === "output_audio_buffer.stopped") {
      heraLog("audio playback ended");
      this.outputLive = false;
      this.setMouth(0);
      if (this.state === "speaking") {
        this.setState("listening");
        heraLog("returned to listening");
      }
      this.commitResponse(false);
      return;
    }

    if (type === "response.done") {
      this.outputLive = false;
      const fromOutput = (data.response?.output ?? [])
        .flatMap((item) => item.content ?? [])
        .map((part) => part.transcript || part.text || "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (fromOutput && this.activeResponse && !this.activeResponse.text) {
        this.activeResponse.text = fromOutput;
      }
      this.commitResponse(false);
      if (this.state === "speaking" || this.state === "thinking") {
        this.setState("listening");
        heraLog("returned to listening");
      }
      return;
    }

    if (type === "conversation.item.input_audio_transcription.delta") {
      this.userPartial += data.delta || "";
      return;
    }
    if (type === "conversation.item.input_audio_transcription.completed") {
      const finalText = eventText(data) || this.userPartial.trim();
      this.userPartial = "";
      if (finalText) this.emit("onUserTurn", finalText);
      return;
    }

    if (
      type === "response.output_audio_transcript.delta" ||
      type === "response.audio_transcript.delta" ||
      type === "response.output_text.delta"
    ) {
      if (!this.activeResponse) this.activeResponse = { id: newId(), text: "", startedAt: Date.now() };
      this.activeResponse.text += data.delta || "";
      return;
    }

    if (
      type === "response.output_audio_transcript.done" ||
      type === "response.audio_transcript.done" ||
      type === "response.output_text.done"
    ) {
      if (!this.activeResponse) this.activeResponse = { id: newId(), text: "", startedAt: Date.now() };
      const done = eventText(data);
      if (done) this.activeResponse.text = done;
      this.commitResponse(false);
    }
  }

  private finishResponse(interrupted: boolean): void {
    this.commitResponse(interrupted);
  }

  private commitResponse(interrupted: boolean): void {
    const current = this.activeResponse;
    if (!current) return;
    current.text = current.text.replace(/\s+/g, " ").trim();
    if (!interrupted && !current.text) return;
    current.completedAt = Date.now();
    current.interrupted = interrupted;
    this.activeResponse = null;
    if (!current.text || this.committedResponseIds.has(current.id)) return;
    this.committedResponseIds.add(current.id);
    this.emit("onAssistantTurn", current);
  }

  private attachOutgoingAnalyser(stream: MediaStream): void {
    this.stopLevelPump();
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    this.audioCtx = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    this.analyser = analyser;
    this.analyserData = new Uint8Array(analyser.fftSize);
    if (ctx.state === "suspended") void ctx.resume();
    const tick = () => {
      if (!this.analyser || !this.analyserData) return;
      const rms = this.outputLive ? rmsFromTimeDomain(this.analyser, this.analyserData) : 0;
      const current = Math.max(0, Math.min(1, rms * 7.5));
      this.setMouth(this.mouthOpen * 0.65 + current * 0.35);
      this.levelRaf = requestAnimationFrame(tick);
    };
    this.levelRaf = requestAnimationFrame(tick);
  }

  private setMouth(next: number): void {
    this.mouthOpen = Math.max(0, Math.min(1, next));
    heraFaceController.setMouthOpen(this.mouthOpen);
    const now = performance.now();
    if (now - this.lastUiLevelAt > 50) {
      this.lastUiLevelAt = now;
      this.emit("onMouthOpen", this.mouthOpen);
    }
  }

  private stopLevelPump(): void {
    if (this.levelRaf) cancelAnimationFrame(this.levelRaf);
    this.levelRaf = 0;
    this.setMouth(0);
  }

  private muteRemote(mute: boolean): void {
    if (this.audioEl) this.audioEl.muted = mute;
  }

  private setState(next: HeraConversationState): void {
    if (this.state === next) return;
    this.state = next;
    heraFaceController.setMode(next === "interrupted" ? "listening" : next === "connecting" ? "thinking" : next === "error" ? "idle" : next);
    this.emit("onState", next);
  }

  private scheduleReconnect(): void {
    if (!this.enabled) return;
    if (this.reconnectTimer) return;
    this.reconnectAttempts += 1;
    if (this.reconnectAttempts > 4) {
      this.failPermanent();
      return;
    }
    this.setState("connecting");
    heraLog("reconnecting", this.reconnectAttempts);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = 0;
      if (!this.enabled) return;
      this.cleanup("connecting");
      void this.openCall();
    }, 700 + this.reconnectAttempts * 400);
  }

  private failPermanent(): void {
    this.enabled = false;
    this.cleanup("idle");
    this.emit("onUnavailable");
  }

  private cleanup(next: HeraConversationState): void {
    const gen = ++this.generation;
    this.connecting = false;
    this.outputLive = false;
    this.activeResponse = null;
    this.stopLevelPump();
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = 0;
    }
    try {
      this.dc?.close();
    } catch {
      /* ignore */
    }
    this.dc = null;
    try {
      this.pc?.getSenders().forEach((sender) => sender.track?.stop());
      this.pc?.close();
    } catch {
      /* ignore */
    }
    this.pc = null;
    if (this.mic) {
      for (const track of this.mic.getTracks()) track.stop();
    }
    this.mic = null;
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.srcObject = null;
      this.audioEl.remove();
      this.audioEl = null;
    }
    if (this.audioCtx) {
      void this.audioCtx.close();
      this.audioCtx = null;
    }
    this.analyser = null;
    this.analyserData = null;
    if (next === "idle") this.committedResponseIds.clear();
    this.setState(next);
    void gen;
  }

  private send(payload: unknown): void {
    if (!this.dc || this.dc.readyState !== "open") return;
    this.dc.send(JSON.stringify(payload));
  }

  private emit<K extends keyof HeraRealtimeEvents>(key: K, ...args: Parameters<NonNullable<HeraRealtimeEvents[K]>>): void {
    for (const listener of this.listeners) {
      const fn = listener[key];
      if (fn) (fn as (...a: typeof args) => void)(...args);
    }
  }
}

export const heraRealtimeController = new HeraRealtimeController();
