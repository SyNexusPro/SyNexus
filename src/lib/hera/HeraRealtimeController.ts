import type { ConversationTurn } from "../oracleSupremeConversation";
import type { HeraConversationState, HeraResponse } from "./types";
import { heraFaceController } from "./HeraFaceController";
import { rmsFromTimeDomain } from "./audioAnalysis";
import { fetchHeraLaunchWatch, fetchHeraLiveToken } from "./liveIntel";
import { hostTimeZone } from "./formatLiveStamp";
import { SYN_MINT, SYN_SYMBOL } from "../../config/synToken";
import { authHeaders } from "../authSession";
import { HERA_CONVERSATION_INSTRUCTIONS, HERA_VOICE_INSTRUCTIONS } from "./heraPrompt";
import { getHeraVoicePreference } from "./heraVoicePreference";

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
  onUserSpeaking?: (speaking: boolean) => void;
  onTranscript?: (text: string) => void;
};

type TokenPayload = {
  mode?: string;
  value?: string;
  client_secret?: { value?: string };
  model?: string;
  voice?: string;
  error?: string;
  session?: { id?: string };
  transport?: { type?: string; sdp?: string };
};

type RealtimeEvent = {
  type?: string;
  event_id?: string;
  response_id?: string;
  delta?: string;
  transcript?: string;
  text?: string;
  content?: string;
  session?: { id?: string };
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
  private muted = false;
  private userSpeaking = false;
  private transcript = "";
  private speakerGain: GainNode | null = null;
  private remoteRoutedToCtx = false;
  private protocol: "live" | "realtime" = "live";
  private livePrimed = false;
  private liveUserTimer = 0;
  private liveOutputTimer = 0;
  private pendingTyped: string[] = [];

  get conversationState(): HeraConversationState {
    return this.state;
  }

  getMouthOpen(): number {
    return this.mouthOpen;
  }

  get connected(): boolean {
    return this.dc?.readyState === "open" && this.pc?.connectionState !== "closed";
  }

  get listening(): boolean {
    return this.enabled && !this.muted && (this.state === "listening" || this.state === "interrupted" || this.state === "thinking");
  }

  isUserSpeaking(): boolean {
    return this.userSpeaking;
  }

  isHeraSpeaking(): boolean {
    return this.outputLive || this.state === "speaking";
  }

  getTranscript(): string {
    return this.transcript;
  }

  isMuted(): boolean {
    return this.muted;
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
      this.applyMute();
      if (this.state === "idle" || this.state === "connecting" || this.state === "error") {
        this.setState("listening");
      }
      return true;
    }
    if (this.connecting) return false;
    if (this.pc) this.teardownPeer();
    return this.openCall();
  }

  connect(opts?: StartOpts): Promise<boolean> {
    return this.start(opts);
  }

  disconnect(): void {
    this.stop();
  }

  startListening(): void {
    this.setMuted(false);
    this.armListening();
  }

  stopListening(): void {
    this.setMuted(true);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMute();
    if (!muted && this.enabled && this.dc?.readyState === "open" && this.state === "idle") {
      this.setState("listening");
    }
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

  /** Voice is fixed when the session starts, so a new voice needs a new session. */
  restartSession(): Promise<boolean> {
    if (!this.enabled) return Promise.resolve(false);
    this.reconnectAttempts = 0;
    this.cleanup("connecting");
    this.enabled = true;
    return this.openCall();
  }

  interrupt(): void {
    if (this.state !== "speaking" && !this.outputLive) return;
    heraLog("assistant interrupted");
    this.outputLive = false;
    this.finishResponse(true);
    if (this.protocol === "realtime") {
      this.muteRemote(true);
      this.send({ type: "response.cancel" });
      this.send({ type: "output_audio_buffer.clear" });
    }
    this.setState("interrupted");
    this.setMouth(0);
    window.setTimeout(() => {
      if (this.enabled && this.state === "interrupted") this.setState("listening");
    }, 120);
  }

  sendText(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return false;
    heraLog("user typed", trimmed);
    this.emit("onUserTurn", trimmed);
    this.transcript = trimmed;
    this.emit("onTranscript", trimmed);
    this.setState("thinking");
    if (!this.canSend()) {
      this.pendingTyped.push(trimmed);
      return this.enabled;
    }
    return this.dispatchUserText(trimmed);
  }

  private dispatchUserText(trimmed: string): boolean {
    if (this.protocol === "live") {
      this.liveAppend(
        "session.thinking.append",
        `The operator typed this message (their current turn, verbatim): ${trimmed}`,
      );
      this.liveAppend(
        "session.commentary.append",
        "Answer that typed message now in one spoken reply. Do not read this cue or the word typed aloud.",
      );
      return true;
    }
    const created = this.send({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: trimmed }],
      },
    });
    const asked = this.send({ type: "response.create" });
    return created && asked;
  }

  private flushPendingTyped(): void {
    if (!this.canSend() || !this.pendingTyped.length) return;
    const queued = this.pendingTyped.splice(0);
    for (const text of queued) this.dispatchUserText(text);
  }

  private async openCall(): Promise<boolean> {
    const gen = ++this.generation;
    this.connecting = true;
    this.setState("connecting");
    heraLog("realtime connecting");
    await this.unlockAudio();
    try {
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
      this.applyMute();
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
        void audioEl.play().then(() => {
          this.attachOutgoingAnalyser(stream, false);
        }).catch((err) => {
          heraError("audio.play", err);
          this.attachOutgoingAnalyser(stream, true);
        });
      });

      const dc = pc.createDataChannel("oai-events");
      this.dc = dc;
      dc.addEventListener("open", () => {
        heraLog("realtime data channel open");
        if (this.protocol === "realtime") this.onTransportReady();
      });
      dc.addEventListener("close", () => heraError("data channel closed"));
      dc.addEventListener("error", (event) => heraError("data channel", event));
      dc.addEventListener("message", (event) => this.onServerEvent(event.data));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this.waitForIce(pc);
      const localSdp = pc.localDescription?.sdp || offer.sdp || "";
      if (!localSdp) throw new Error("Missing local SDP offer");
      const session = await this.createServerSession(localSdp);
      if (this.generation !== gen) return false;
      this.protocol = session.mode;
      await pc.setRemoteDescription({ type: "answer", sdp: session.sdp });
      heraLog(
        "voice session",
        `${this.protocol} · ${session.model ?? "default model"} · voice ${session.voice ?? "default"}`,
      );
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

  /** Waits for ICE gathering so the server receives a complete offer. */
  private async waitForIce(pc: RTCPeerConnection): Promise<void> {
    if (pc.iceGatheringState === "complete") return;
    await new Promise<void>((resolve) => {
      const done = () => {
        if (pc.iceGatheringState !== "complete") return;
        pc.removeEventListener("icegatheringstatechange", done);
        window.clearTimeout(timer);
        resolve();
      };
      const timer = window.setTimeout(() => {
        pc.removeEventListener("icegatheringstatechange", done);
        resolve();
      }, 3000);
      pc.addEventListener("icegatheringstatechange", done);
      done();
    });
  }

  /**
   * Server exchanges our offer for an answer. GPT-Live-1 answers with
   * `mode: "live"`; the Realtime fallback answers with `mode: "realtime"`.
   */
  private async createServerSession(
    offerSdp: string,
  ): Promise<{ mode: "live" | "realtime"; sdp: string; model?: string; voice?: string }> {
    const headers = await authHeaders({ "Content-Type": "application/json" });
    const body = JSON.stringify({ sdp: offerSdp, voice: getHeraVoicePreference() ?? undefined });
    let res = await fetch("/api/hera/session", { method: "POST", headers, body }).catch(() => null);
    if (!res?.ok) {
      res = await fetch("/api/hera/realtime-session", { method: "POST", headers, body });
    }
    const json = (await res.json()) as TokenPayload;
    if (!res.ok) throw new Error(json.error || `session HTTP ${res.status}`);
    const answer = json.transport?.sdp?.trim() || "";
    if (!answer) throw new Error("no SDP answer from voice session");
    return {
      mode: json.mode === "realtime" ? "realtime" : "live",
      sdp: answer,
      model: json.model,
      voice: json.voice,
    };
  }

  /** Transport is usable: Realtime on data-channel open, Live on `session.started`. */
  private onTransportReady(): void {
    this.connecting = false;
    this.reconnectAttempts = 0;
    this.emit("onError", "");
    this.setState("listening");
    heraLog("realtime connected");
    void this.primeConversation();
  }

  /** GPT-Live context injection. `delegation_id: null` is session-wide. */
  private liveAppend(
    type: "session.instructions.append" | "session.thinking.append" | "session.commentary.append",
    content: string,
  ): void {
    const text = content.trim();
    if (!text) return;
    this.send({ type, event_id: newId(), delegation_id: null, content: text.slice(0, 1800) });
  }

  private async primeConversation(): Promise<void> {
    if (this.livePrimed && this.protocol === "live") return;
    this.livePrimed = true;
    if (this.protocol === "live") {
      this.liveAppend("session.instructions.append", HERA_VOICE_INSTRUCTIONS);
    } else {
      this.send({
        type: "session.update",
        session: {
          type: "realtime",
          instructions: HERA_CONVERSATION_INSTRUCTIONS,
          audio: {
            output: { instructions: HERA_VOICE_INSTRUCTIONS },
          },
        },
      });
    }
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
    const history = this.pendingHistory.filter((item) => item.text.trim()).slice(-10);
    if (this.protocol === "live") {
      if (context) {
        this.liveAppend("session.thinking.append", `Session context (do not read aloud unless asked): ${context}`);
      }
      if (history.length) {
        const recap = history
          .map((turn) => `${turn.role === "oracle" ? "Hera" : "Operator"}: ${turn.text}`)
          .join(" | ");
        this.liveAppend("session.thinking.append", `Earlier in this conversation: ${recap}`);
      }
    } else {
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
      for (const turn of history) {
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
    }
    const seed = this.pendingSeed;
    this.pendingSeed = "";
    if (seed.length >= 6) {
      this.sendText(seed);
    }
    this.flushPendingTyped();
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

    // ── GPT-Live-1 lifecycle and transcripts ──
    if (type === "session.started") {
      heraLog("live session started", data.session?.id);
      this.onTransportReady();
      return;
    }

    if (type === "session.closed") {
      heraLog("live session closed");
      this.outputLive = false;
      this.setMouth(0);
      this.commitResponse(false);
      if (this.enabled) this.scheduleReconnect();
      return;
    }

    if (type === "session.input_transcript.delta") {
      const fragment = data.delta || data.text || data.content || "";
      if (!fragment) return;
      this.userPartial = `${this.userPartial}${this.userPartial ? " " : ""}${fragment}`.trim();
      this.transcript = this.userPartial;
      this.emit("onTranscript", this.transcript);
      this.noteLiveUserSpeech();
      return;
    }

    if (type === "session.output_transcript.delta") {
      const fragment = data.delta || data.text || data.content || "";
      if (!fragment) return;
      if (!this.activeResponse) this.activeResponse = { id: newId(), text: "", startedAt: Date.now() };
      this.activeResponse.text = `${this.activeResponse.text}${this.activeResponse.text ? " " : ""}${fragment}`.trim();
      this.noteLiveOutput();
      return;
    }

    if (type === "input_audio_buffer.speech_started") {
      heraLog("user speech started");
      this.userSpeaking = true;
      this.emit("onUserSpeaking", true);
      if (this.state === "speaking" || this.outputLive) this.interrupt();
      else this.setState("listening");
      return;
    }

    if (type === "input_audio_buffer.speech_stopped") {
      heraLog("user speech ended");
      this.userSpeaking = false;
      this.emit("onUserSpeaking", false);
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
      this.transcript = this.userPartial;
      this.emit("onTranscript", this.transcript);
      return;
    }
    if (type === "conversation.item.input_audio_transcription.completed") {
      const finalText = eventText(data) || this.userPartial.trim();
      this.userPartial = "";
      this.transcript = finalText;
      this.emit("onTranscript", this.transcript);
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

  /**
   * GPT-Live is full duplex: it has no speech start/stop events, so user and
   * assistant activity are inferred from transcript fragments going quiet.
   */
  private noteLiveUserSpeech(): void {
    if (!this.userSpeaking) {
      this.userSpeaking = true;
      this.emit("onUserSpeaking", true);
    }
    window.clearTimeout(this.liveUserTimer);
    this.liveUserTimer = window.setTimeout(() => {
      this.userSpeaking = false;
      this.emit("onUserSpeaking", false);
      const finalText = this.userPartial.trim();
      this.userPartial = "";
      if (finalText) this.emit("onUserTurn", finalText);
    }, 900);
  }

  private noteLiveOutput(): void {
    this.outputLive = true;
    this.muteRemote(false);
    this.setState("speaking");
    window.clearTimeout(this.liveOutputTimer);
    this.liveOutputTimer = window.setTimeout(() => {
      this.outputLive = false;
      this.setMouth(0);
      this.commitResponse(false);
      if (this.state === "speaking") this.setState("listening");
    }, 800);
  }

  private clearLiveTimers(): void {
    window.clearTimeout(this.liveUserTimer);
    window.clearTimeout(this.liveOutputTimer);
    this.liveUserTimer = 0;
    this.liveOutputTimer = 0;
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

  private attachOutgoingAnalyser(stream: MediaStream, playThroughContext: boolean): void {
    this.stopLevelPump();
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    this.audioCtx = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    if (playThroughContext) {
      const gain = ctx.createGain();
      gain.gain.value = 1;
      source.connect(gain);
      gain.connect(ctx.destination);
      this.speakerGain = gain;
      this.remoteRoutedToCtx = true;
      if (this.audioEl) this.audioEl.muted = true;
    } else {
      this.speakerGain = null;
      this.remoteRoutedToCtx = false;
    }
    this.analyser = analyser;
    this.analyserData = new Uint8Array(analyser.fftSize);
    if (ctx.state === "suspended") void ctx.resume();
    const tick = () => {
      if (!this.analyser || !this.analyserData) return;
      const rms = this.outputLive ? rmsFromTimeDomain(this.analyser, this.analyserData) : 0;
      const current = Math.max(0, Math.min(1, rms * 6.2));
      const gated = current < 0.045 ? 0 : current;
      this.setMouth(this.mouthOpen * 0.84 + gated * 0.16);
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
    if (this.audioEl && !this.remoteRoutedToCtx) this.audioEl.muted = mute;
    if (this.speakerGain && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.speakerGain.gain.cancelScheduledValues(now);
      this.speakerGain.gain.setValueAtTime(this.speakerGain.gain.value, now);
      this.speakerGain.gain.linearRampToValueAtTime(mute ? 0.0001 : 1, now + 0.04);
    }
  }

  private applyMute(): void {
    const live = !this.muted;
    if (this.mic) {
      for (const track of this.mic.getAudioTracks()) track.enabled = live;
    }
    this.pc?.getSenders().forEach((sender) => {
      if (sender.track?.kind === "audio") sender.track.enabled = live;
    });
  }

  private teardownPeer(): void {
    this.connecting = false;
    this.outputLive = false;
    this.userSpeaking = false;
    this.livePrimed = false;
    this.clearLiveTimers();
    this.stopLevelPump();
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
    this.speakerGain = null;
    this.remoteRoutedToCtx = false;
    if (this.audioCtx) {
      void this.audioCtx.close();
      this.audioCtx = null;
    }
    this.analyser = null;
    this.analyserData = null;
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
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = 0;
    }
    this.activeResponse = null;
    this.teardownPeer();
    if (next === "idle") this.committedResponseIds.clear();
    this.setState(next);
    void gen;
  }

  private canSend(): boolean {
    return Boolean(this.dc && this.dc.readyState === "open");
  }

  private send(payload: unknown): boolean {
    if (!this.canSend() || !this.dc) return false;
    this.dc.send(JSON.stringify(payload));
    return true;
  }

  private emit<K extends keyof HeraRealtimeEvents>(key: K, ...args: Parameters<NonNullable<HeraRealtimeEvents[K]>>): void {
    for (const listener of this.listeners) {
      const fn = listener[key];
      if (fn) (fn as (...a: typeof args) => void)(...args);
    }
  }
}

export const heraRealtimeController = new HeraRealtimeController();
