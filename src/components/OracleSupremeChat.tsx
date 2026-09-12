import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createTurn,
  type ConversationTurn,
  type DayMoodReply,
  type OracleConversationContext,
  loadConversationHistory,
  markIntroWelcomeSpoken,
  reactToFreeText,
  saveConversationHistory,
  DAY_MOOD_QUICK_REPLIES,
} from "../lib/oracleSupremeConversation";
import { respondToTitanMessage, warmTitanBrain } from "../lib/titanConversation";
import { guardOracleChat } from "../lib/securityBot";
import { recordTitanFeedback, hasTitanFeedbackConsent } from "../lib/titanFeedback";
import {
  hasTitanVoiceEnabled,
  isTitanSpeaking,
  isTitanVoiceSupported,
  speakTitan,
  stopTitanSpeech,
  unlockTitanSpeech,
} from "../lib/titanVoice";
import type { HeraAvatarState, HeraEmotion, HeraInterfaceMode } from "../lib/hera/types";
import { isHeraPresenceMode, isHeraVisionMode, isHeraVoiceCapableMode, normalizeHeraMode } from "../lib/hera/types";
import { useHeraAvatarState } from "../hooks/useHeraAvatarState";
import { useHeraVoiceInput } from "../hooks/useHeraVoiceInput";
import { useHeraVoiceOutput } from "../hooks/useHeraVoiceOutput";
import { useHeraRealtime } from "../hooks/useHeraRealtime";
import { TitanChatSettings } from "./TitanChatSettings";
import { SynexusSymbolMark } from "./SynexusSymbolMark";
import { HeraInterfaceModes } from "./hera/HeraInterfaceModes";
import { HeraVoiceControls } from "./hera/HeraVoiceControls";
import { HeraHologramPortrait } from "./hera/HeraHologramPortrait";
import { useHeraBargeIn } from "../hooks/useHeraBargeIn";
import { fetchHeraLiveToken } from "../lib/hera/liveIntel";
import { hostTimeZone } from "../lib/hera/formatLiveStamp";
import { SYN_MINT, SYN_SYMBOL } from "../config/synToken";
import { HeraHologramStage } from "./hera/HeraHologramStage";
import { isWakeOnlyUtterance, stripWakePrefix } from "../lib/hera/wakeWord";
import { useTranslation } from "react-i18next";
import { useHeraVersion } from "../hooks/useHeraVersion";
import { buildHeraSignupDemoLine, markHeraSignupDemoComplete } from "../lib/heraSignupDemo";

function firstVoiceChunk(text: string): string | null {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const sentence = trimmed.match(/^[\s\S]{8,180}?[.!?…](?:\s|$)/);
  if (sentence) return sentence[0].trim();
  const clause = trimmed.match(/^[\s\S]{12,140}?,(?:\s|$)/);
  if (clause && trimmed.length >= 28) return clause[0].trim();
  if (trimmed.length >= 36) {
    const slice = trimmed.slice(0, 80);
    const cut = slice.lastIndexOf(" ");
    return (cut > 16 ? slice.slice(0, cut) : slice).trim();
  }
  return null;
}

type OracleSupremeChatProps = {
  context: OracleConversationContext;
  variant?: "overlay" | "inline" | "widget" | "hera-screen";
  /** Titan sheet: thread + composer only — no chips, settings, or duplicate chrome. */
  minimal?: boolean;
  showOpeningPrompt?: boolean;
  onDismiss?: () => void;
  autoListen?: boolean;
  seedUtterance?: string | null;
  wakePulse?: boolean;
  guidedDemo?: boolean;
};

export function OracleSupremeChat({
  context,
  variant = "inline",
  minimal = false,
  showOpeningPrompt = false,
  onDismiss,
  autoListen = false,
  seedUtterance = null,
  wakePulse = false,
  guidedDemo = false,
}: OracleSupremeChatProps) {
  const { t } = useTranslation();
  const { tag: heraTag } = useHeraVersion(context.titanBotName);
  const [turns, setTurns] = useState<ConversationTurn[]>(() => loadConversationHistory());
  const [draft, setDraft] = useState("");
  const [awaitingDayReply, setAwaitingDayReply] = useState(showOpeningPrompt);
  const [lastUserTopic, setLastUserTopic] = useState("");
  const [thinking, setThinking] = useState(false);
  const [streamingTurnId, setStreamingTurnId] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const screenMode = variant === "hera-screen";
  const [interfaceMode, setInterfaceMode] = useState<HeraInterfaceMode>(screenMode ? "vision" : "chat");
  const [forceAvatarState, setForceAvatarState] = useState<HeraAvatarState | null>(null);
  const [forceEmotion, setForceEmotion] = useState<HeraEmotion | null>(null);
  const autoSpokeRef = useRef(false);
  const fallbackSeedRef = useRef(false);
  const guidedDemoRef = useRef(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const submitRef = useRef<(text: string) => Promise<void> | void>(() => undefined);
  const [showWakePulse, setShowWakePulse] = useState(wakePulse);
  const mode = normalizeHeraMode(interfaceMode);
  const voiceMode = screenMode || isHeraVoiceCapableMode(interfaceMode);
  const hologramMode = screenMode || isHeraVisionMode(interfaceMode);
  const presenceMode = screenMode || isHeraPresenceMode(interfaceMode);
  const analysisMode = !screenMode && mode === "analysis";

  const realtime = useHeraRealtime({
    active: screenMode,
    history: turns,
    seedText: (() => {
      const seed = seedUtterance?.trim() ?? "";
      if (!seed || isWakeOnlyUtterance(seed)) return "";
      return stripWakePrefix(seed) || seed;
    })(),
    onUserTurn: (text) => {
      setTurns((prev) => {
        if (prev.some((turn) => turn.role === "user" && turn.text === text)) return prev;
        const next = [...prev, createTurn("user", text)];
        saveConversationHistory(next);
        return next;
      });
    },
    onAssistantTurn: (response) => {
      if (!response.text) return;
      setTurns((prev) => {
        if (prev.some((turn) => turn.id === response.id || turn.responseId === response.id)) return prev;
        const turn = { ...createTurn("oracle", response.text), id: response.id, responseId: response.id };
        const next = [...prev, turn];
        saveConversationHistory(next);
        return next;
      });
    },
  });
  const liveVoice = screenMode && realtime.connected;
  const textTalk = screenMode && !liveVoice;

  const voiceOut = useHeraVoiceOutput({ ensureEnabled: voiceMode && !liveVoice });
  const voiceIn = useHeraVoiceInput({
    enabled: voiceMode && (!screenMode || textTalk),
    autoRestart: textTalk,
    muted: thinking || voiceOut.speaking || speaking,
    onFinalTranscript: (text) => {
      void submitRef.current(text);
    },
  });

  const avatar = useHeraAvatarState(
    {
      isActive: true,
      listening: liveVoice ? realtime.listening : voiceIn.listening || textTalk,
      thinking: liveVoice ? realtime.thinking : thinking,
      speaking: liveVoice ? realtime.speaking : speaking || voiceOut.speaking,
      audioLevel: liveVoice ? realtime.mouthOpen : Math.max(voiceIn.audioLevel, voiceOut.speaking ? 0.35 : 0),
      forceState: liveVoice
        ? realtime.state === "error" || realtime.state === "connecting"
          ? "listening"
          : realtime.state
        : textTalk
          ? speaking || voiceOut.speaking
            ? "speaking"
            : thinking
              ? "thinking"
              : "listening"
          : forceAvatarState,
      forceEmotion: screenMode ? "neutral" : forceEmotion,
      analysisMode,
    },
    context.titanBotName,
  );

  const coinQuickPicks = useMemo(() => {
    const trending = [...context.tokens]
      .sort((a, b) => Math.abs(b.change24hPct) - Math.abs(a.change24hPct))
      .slice(0, 4);
    return trending.map((t) => t.symbol);
  }, [context.tokens]);

  const appendOracle = useCallback((text: string) => {
    setTurns((prev) => {
      const next = [...prev, createTurn("oracle", text)];
      saveConversationHistory(next);
      return next;
    });
  }, []);

  const updateOracleTurn = useCallback((turnId: string, text: string) => {
    setTurns((prev) => {
      const next = prev.map((turn) => (turn.id === turnId ? { ...turn, text } : turn));
      saveConversationHistory(next);
      return next;
    });
  }, []);

  const streamIdRef = useRef<string | null>(null);
  useHeraBargeIn({
    active: !screenMode && (voiceOut.speaking || speaking),
    onBargeIn: () => {
      abortRef.current?.abort();
      voiceOut.stop();
      stopTitanSpeech();
      setThinking(false);
      setSpeaking(false);
    },
  });

  useEffect(() => {
    if (!screenMode) return;
    void fetchHeraLiveToken({ mint: SYN_MINT, symbol: SYN_SYMBOL, tz: hostTimeZone() });
  }, [screenMode]);

  const appendUser = useCallback((text: string) => {
    setTurns((prev) => {
      const next = [...prev, createTurn("user", text)];
      saveConversationHistory(next);
      return next;
    });
  }, []);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, thinking, streamingTurnId]);

  useEffect(() => {
    warmTitanBrain();
  }, []);

  useEffect(() => {
    if (!guidedDemo || guidedDemoRef.current) return;
    guidedDemoRef.current = true;
    const line = buildHeraSignupDemoLine(context.operatorName);
    appendOracle(line);
    markHeraSignupDemoComplete();
    if (voiceMode) {
      unlockTitanSpeech();
      void voiceOut.speak(line);
      return;
    }
    if (hasTitanVoiceEnabled()) {
      speakTitan(line, {
        onStart: () => setSpeaking(true),
        onEnd: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      });
    }
  }, [appendOracle, context.operatorName, guidedDemo, voiceMode, voiceOut]);

  function speakReply(text: string) {
    if (!text.trim()) return;
    if (voiceMode) {
      unlockTitanSpeech();
      void voiceOut.speak(text);
      return;
    }
    if (!hasTitanVoiceEnabled()) return;
    speakTitan(text, {
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  }

  async function submitQuery(text: string) {
    const trimmed = stripWakePrefix(text.trim()) || text.trim();
    if (!trimmed) return;
    if (isWakeOnlyUtterance(text) || isWakeOnlyUtterance(trimmed)) {
      return;
    }
    if (trimmed.length < 2) {
      return;
    }
    if (thinking && !screenMode) return;
    if (thinking) abortRef.current?.abort();

    stopTitanSpeech();
    voiceOut.stop();
    if (liveVoice) {
      realtime.sendText(trimmed);
      setDraft("");
      setAwaitingDayReply(false);
      setLastUserTopic(trimmed);
      return;
    }
    setSpeaking(false);

    const security = guardOracleChat(trimmed);
    if (!security.allowed) {
      appendOracle(security.message ?? "Message blocked by SyNexus security.");
      return;
    }

    setDraft("");
    setAwaitingDayReply(false);
    setLastUserTopic(trimmed);
    appendUser(trimmed);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const streamTurn = createTurn("oracle", "");
    const streamId = streamTurn.id;
    streamIdRef.current = streamId;
    setThinking(true);
    setStreamingTurnId(streamId);
    setTurns((prev) => {
      const next = [...prev, streamTurn];
      saveConversationHistory(next);
      return next;
    });

    let spokenLead = "";
    try {
      const priorTurns = [...turns, createTurn("user", trimmed)].filter((turn) => turn.text.trim());
      const reply = await respondToTitanMessage(trimmed, context, priorTurns, {
        signal: controller.signal,
        fastMode: false,
        spokenReply: voiceMode,
        onDelta: (partial) => {
          updateOracleTurn(streamId, partial);
          if (!voiceMode || spokenLead) return;
          const lead = firstVoiceChunk(partial);
          if (!lead) return;
          spokenLead = lead;
          speakReply(lead);
        },
      });
      updateOracleTurn(streamId, reply);
      if (!spokenLead) speakReply(reply);
      else {
        const rest = reply.slice(spokenLead.length).replace(/^\s*[,;:.–-]+\s*/, "").trim();
        if (rest.length > 8) speakReply(rest);
      }
    } catch {
      if (!controller.signal.aborted) {
        const fallback = reactToFreeText(trimmed, context);
        updateOracleTurn(streamId, fallback);
        if (!spokenLead) speakReply(fallback);
      }
    } finally {
      streamIdRef.current = null;
      setThinking(false);
      setStreamingTurnId(null);
    }
  }

  submitRef.current = submitQuery;

  useEffect(() => {
    if (!screenMode) return;
    if (!wakePulse && !autoListen && !seedUtterance) return;
    setShowWakePulse(true);
    const t = window.setTimeout(() => setShowWakePulse(false), 1800);
    return () => window.clearTimeout(t);
  }, [autoListen, screenMode, seedUtterance, wakePulse]);

  useEffect(() => {
    if (!textTalk || fallbackSeedRef.current) return;
    if (!realtime.unavailable && realtime.state === "connecting") return;
    fallbackSeedRef.current = true;
    unlockTitanSpeech();
    const seed = stripWakePrefix(seedUtterance?.trim() ?? "") || seedUtterance?.trim() || "";
    if (seed.length >= 6 && !isWakeOnlyUtterance(seed)) {
      void submitRef.current(seed);
    }
  }, [realtime.state, realtime.unavailable, seedUtterance, textTalk]);

  useEffect(() => {
    if (mode === "chat") {
      setForceAvatarState(null);
      setForceEmotion(null);
      voiceIn.abort();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (!showOpeningPrompt || autoSpokeRef.current) return;
    autoSpokeRef.current = true;

    const history = loadConversationHistory();
    const last = history.at(-1);
    const stale = !last || Date.now() - last.at > 4 * 60 * 60 * 1000;

    if (history.length > 0 && !stale) {
      setTurns(history);
      setAwaitingDayReply(false);
    }
  }, [showOpeningPrompt]);

  function handleMoodReply(mood: DayMoodReply, label: string) {
    void submitQuery(`${label} — ${mood === "rough" ? "having a rough day" : mood === "trading" ? "busy trading" : mood === "long" ? "long day" : "feeling good"}`);
  }

  function handleSend() {
    unlockTitanSpeech();
    void submitQuery(draft);
  }

  function handleCoinSearch(symbol: string) {
    void submitQuery(`scan ${symbol}`);
  }

  function handleCheckIn() {
    setAwaitingDayReply(false);
    markIntroWelcomeSpoken();
    appendOracle("I'm here — markets, strategy, life, whatever you need. Talk to me.");
  }

  async function handleMicToggle() {
    if (screenMode) return;
    if (voiceIn.transcribing) return;
    stopTitanSpeech();
    voiceOut.stop();
    setSpeaking(false);
    unlockTitanSpeech();
    if (thinking) {
      abortRef.current?.abort();
      setThinking(false);
    }
    if (voiceIn.listening) {
      await voiceIn.stopListening();
      return;
    }
    await voiceIn.startListening();
  }

  const visibleTurns = turns;
  const showHologram = hologramMode;
  const condensedThread = hologramMode;
  const isActivelySpeaking = liveVoice ? realtime.speaking : speaking || voiceOut.speaking;
  const lastSpoken = [...visibleTurns].reverse().find((turn) => turn.role === "oracle" && turn.text.trim());
  const liveCaption = liveVoice
    ? realtime.state === "thinking"
      ? lastSpoken?.text || "Thinking…"
      : lastSpoken?.text || (realtime.state === "speaking" ? null : "Listening…")
    : thinking
      ? "Thinking…"
      : voiceIn.partial
        ? voiceIn.partial
        : lastSpoken?.text || "Listening…";

  if (screenMode) {
    return (
      <div className="hera-screen" role="dialog" aria-modal="true" aria-label={`Talk to ${context.titanBotName}`}>
        <button type="button" className="hera-screen__close" onClick={onDismiss} aria-label="Close Hera">
          ×
        </button>

        <div id="hera-avatar-slot" className="hera-screen__stage">
          <HeraHologramPortrait
            state={avatar.state}
            isActive={avatar.isActive}
            emotion={avatar.emotion}
            audioLevel={liveVoice ? realtime.mouthOpen : Math.max(voiceIn.audioLevel, voiceOut.audioLevel)}
            viseme={avatar.viseme}
            className={showWakePulse ? "hera-hologram--wake-forward" : ""}
          />
        </div>

        <div className="hera-screen__dock">
          {liveCaption ? (
            <p className={`hera-screen__caption${(textTalk || realtime.listening) && !isActivelySpeaking ? " hera-screen__caption--listen" : ""}`}>
              {liveCaption}
            </p>
          ) : null}
          <form
            className="hera-screen__type"
            onSubmit={(event) => {
              event.preventDefault();
              handleSend();
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type to Hera…"
              aria-label={`Message to ${context.titanBotName}`}
              autoComplete="off"
              enterKeyHint="send"
            />
            <button type="submit" disabled={!draft.trim()} aria-label="Send">
              Send
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`oracle-chat oracle-chat--${variant}${minimal ? " oracle-chat--minimal" : ""}${isActivelySpeaking ? " oracle-chat--speaking" : ""}${hologramMode ? " oracle-chat--hologram" : ""}${presenceMode ? " oracle-chat--presence" : ""}${analysisMode ? " oracle-chat--analysis" : ""}`}
      role="region"
      aria-label={`Conversation with ${context.titanBotName}`}
    >
      <HeraInterfaceModes
        mode={mode}
        onChange={setInterfaceMode}
        botName={context.titanBotName}
      />

      {showHologram ? (
        <HeraHologramStage
          state={avatar.state}
          isActive={avatar.isActive}
          audioLevel={avatar.audioLevel}
          viseme={avatar.viseme}
          emotion={avatar.emotion}
          statusLabel={`${context.titanBotName} ${heraTag} · ${avatar.statusLabel}`}
          expanded={variant === "overlay" || variant === "inline"}
          immersive={presenceMode}
          onStageTap={presenceMode ? () => void handleMicToggle() : undefined}
          showStatePreview={import.meta.env.DEV && !presenceMode}
          previewState={forceAvatarState}
          onPreviewState={setForceAvatarState}
          forceEmotion={forceEmotion}
          onForceEmotion={setForceEmotion}
        />
      ) : null}

      {analysisMode && !thinking ? (
        <div className="hera-analysis-chips" role="group" aria-label="Quick analysis">
          <button type="button" className="oracle-chat__chip" onClick={() => void submitQuery("What are the best ones today?")}>
            Best today
          </button>
          <button type="button" className="oracle-chat__chip" onClick={() => void submitQuery("What’s moving right now?")}>
            Moving now
          </button>
          <button type="button" className="oracle-chat__chip" onClick={() => void submitQuery("What should I watch today?")}>
            Watch list
          </button>
        </div>
      ) : null}

      {!minimal && !hologramMode ? (
        <div className="oracle-chat__head">
          <div className="oracle-chat__avatar" aria-hidden="true">
            <span className="oracle-chat__avatar-ring" />
            <SynexusSymbolMark size="chat" />
          </div>
          <div>
            <p className="oracle-chat__name">
              {context.titanBotName}
              <span className="hera-version-chip">{heraTag}</span>
            </p>
            <p className="oracle-chat__status">
              {thinking
                ? `${context.titanBotName} is thinking…`
                : context.tokens.length
                  ? `SyNexus brain online · live markets · ask anything`
                  : "Syncing market feed…"}
            </p>
          </div>
          {variant === "widget" || variant === "overlay" ? (
            onDismiss ? (
              <button type="button" className="oracle-chat__close" onClick={onDismiss} aria-label="Minimize">
                ×
              </button>
            ) : null
          ) : null}
        </div>
      ) : null}

      <div
        className={`oracle-chat__thread${condensedThread ? " oracle-chat__thread--condensed" : ""}`}
        aria-live="polite"
        ref={threadRef}
      >
        {visibleTurns.length === 0 ? (
          <div className="oracle-chat__empty-wrap">
            <p className="oracle-chat__empty">
              {presenceMode
                ? `Tap ${context.titanBotName} to speak — she's right here.`
                : hologramMode
                  ? `Speak or type to ${context.titanBotName}.`
                  : minimal
                    ? `Message ${context.titanBotName} — crypto, advice, or anything on your mind.`
                    : `Talk to ${context.titanBotName} about anything — markets, decisions, or what you're working through.`}
            </p>
            {!minimal && !hologramMode ? (
              <button type="button" className="oracle-chat__chip" onClick={handleCheckIn}>
                Start talking
              </button>
            ) : null}
          </div>
        ) : null}
        {visibleTurns.map((turn) => (
          <div
            key={turn.id}
            className={`oracle-chat__bubble oracle-chat__bubble--${turn.role}${
              turn.id === streamingTurnId ? " oracle-chat__bubble--streaming" : ""
            }`}
          >
            {turn.text ||
              (turn.id === streamingTurnId ? (
                <span className="oracle-chat__thinking" aria-hidden>
                  …
                </span>
              ) : null)}
          </div>
        ))}
      </div>

      {voiceMode ? (
        <HeraVoiceControls
          listening={voiceIn.listening}
          supported={voiceIn.supported}
          partial={voiceIn.partial}
          error={voiceIn.error}
          disabled={thinking}
          onToggle={() => {
            void handleMicToggle();
          }}
        />
      ) : null}

      {!minimal && !hologramMode && coinQuickPicks.length ? (
        <div className="oracle-chat__coin-row">
          <p className="oracle-chat__quick-label">Search coins</p>
          <div className="oracle-chat__chips">
            {coinQuickPicks.map((symbol) => (
              <button
                key={symbol}
                type="button"
                className="oracle-chat__chip oracle-chat__chip--coin"
                onClick={() => handleCoinSearch(symbol)}
              >
                {symbol}
              </button>
            ))}
            <button
              type="button"
              className="oracle-chat__chip oracle-chat__chip--coin"
              onClick={() => void submitQuery("Aegis security and privacy")}
            >
              Security &amp; privacy
            </button>
            <button
              type="button"
              className="oracle-chat__chip oracle-chat__chip--coin"
              onClick={() => void submitQuery("sentinel status")}
            >
              Sentinel status
            </button>
            <button
              type="button"
              className="oracle-chat__chip oracle-chat__chip--coin"
              onClick={() => void submitQuery("what can you do")}
            >
              What can you do?
            </button>
          </div>
        </div>
      ) : null}

      {!minimal && awaitingDayReply && !hologramMode ? (
        <div className="oracle-chat__quick">
          <p className="oracle-chat__quick-label">Quick reply</p>
          <div className="oracle-chat__chips">
            {DAY_MOOD_QUICK_REPLIES.map((item) => (
              <button
                key={item.id}
                type="button"
                className="oracle-chat__chip"
                onClick={() => handleMoodReply(item.id, item.label)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <form
        className="oracle-chat__composer"
        onSubmit={(event) => {
          event.preventDefault();
          handleSend();
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("titan.placeholder")}
          aria-label={`Message to ${context.titanBotName}`}
          disabled={thinking}
        />
        <button type="submit" disabled={!draft.trim() || thinking}>
          {thinking ? t("titan.thinking") : "Send"}
        </button>
      </form>

      {isTitanVoiceSupported() && mode === "chat" ? (
        <div className="oracle-chat__voice-row">
          <button
            type="button"
            className={`oracle-chat__voice-btn${speaking || isTitanSpeaking() ? " oracle-chat__voice-btn--stop" : ""}`}
            onClick={() => {
              if (speaking || isTitanSpeaking() || voiceOut.speaking) {
                stopTitanSpeech();
                voiceOut.stop();
                setSpeaking(false);
                return;
              }
              const lastOracle = [...visibleTurns].reverse().find((t) => t.role === "oracle" && t.text.trim());
              if (lastOracle) speakReply(lastOracle.text);
            }}
          >
            {speaking || isTitanSpeaking() ? "Stop voice" : "Hear Titan"}
          </button>
          {!hasTitanVoiceEnabled() ? (
            <span className="oracle-chat__voice-hint">Enable voice in settings for auto-speak</span>
          ) : null}
        </div>
      ) : null}

      {voiceMode && (isActivelySpeaking || voiceOut.speaking) ? (
        <div className="oracle-chat__voice-row">
          <button
            type="button"
            className="oracle-chat__voice-btn oracle-chat__voice-btn--stop"
            onClick={() => {
              stopTitanSpeech();
              voiceOut.stop();
              setSpeaking(false);
            }}
          >
            Stop speaking
          </button>
        </div>
      ) : null}

      {!minimal && visibleTurns.length > 0 && hasTitanFeedbackConsent() && !hologramMode ? (
        <div className="oracle-chat__feedback">
          <span className="oracle-chat__feedback-label">Was that helpful?</span>
          <button
            type="button"
            className="oracle-chat__feedback-btn"
            onClick={() => recordTitanFeedback("helpful", lastUserTopic || visibleTurns.at(-1)?.text || "chat")}
          >
            Yes
          </button>
          <button
            type="button"
            className="oracle-chat__feedback-btn"
            onClick={() => recordTitanFeedback("not_helpful", lastUserTopic || visibleTurns.at(-1)?.text || "chat")}
          >
            Not really
          </button>
        </div>
      ) : null}

      {presenceMode ? null : minimal ? (
        <TitanChatSettings titanBotName={context.titanBotName} voiceOnly />
      ) : (
        <TitanChatSettings titanBotName={context.titanBotName} />
      )}
    </div>
  );
}
