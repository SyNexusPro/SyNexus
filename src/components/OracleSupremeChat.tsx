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
import { isInstantTitanPath } from "../lib/titanRouting";
import { oracleRespondToMessage } from "../lib/oracleCryptoBrain";
import { guardOracleChat } from "../lib/securityBot";
import { recordTitanFeedback, hasTitanFeedbackConsent } from "../lib/titanFeedback";
import {
  hasTitanVoiceEnabled,
  isTitanSpeaking,
  isTitanVoiceSupported,
  speakTitan,
  stopTitanSpeech,
} from "../lib/titanVoice";
import { TitanChatSettings } from "./TitanChatSettings";
import { SynexusSymbolMark } from "./SynexusSymbolMark";

type OracleSupremeChatProps = {
  context: OracleConversationContext;
  variant?: "overlay" | "inline" | "widget";
  /** Titan sheet: thread + composer only — no chips, settings, or duplicate chrome. */
  minimal?: boolean;
  showOpeningPrompt?: boolean;
  onDismiss?: () => void;
};

export function OracleSupremeChat({
  context,
  variant = "inline",
  minimal = false,
  showOpeningPrompt = false,
  onDismiss,
}: OracleSupremeChatProps) {
  const [turns, setTurns] = useState<ConversationTurn[]>(() => loadConversationHistory());
  const [draft, setDraft] = useState("");
  const [awaitingDayReply, setAwaitingDayReply] = useState(showOpeningPrompt);
  const [lastUserTopic, setLastUserTopic] = useState("");
  const [thinking, setThinking] = useState(false);
  const [streamingTurnId, setStreamingTurnId] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const autoSpokeRef = useRef(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

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

  function speakReply(text: string) {
    if (!hasTitanVoiceEnabled() || !text.trim()) return;
    speakTitan(text, {
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  }

  async function submitQuery(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;

    stopTitanSpeech();
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

    if (isInstantTitanPath(trimmed)) {
      const instant = oracleRespondToMessage(trimmed, context);
      if (instant) {
        appendOracle(instant);
        speakReply(instant);
        return;
      }
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const streamTurn = createTurn("oracle", "");
    const streamId = streamTurn.id;
    setThinking(true);
    setStreamingTurnId(streamId);
    setTurns((prev) => {
      const next = [...prev, streamTurn];
      saveConversationHistory(next);
      return next;
    });

    try {
      const priorTurns = [...turns, createTurn("user", trimmed)];
      const reply = await respondToTitanMessage(trimmed, context, priorTurns, {
        signal: controller.signal,
        onDelta: (partial) => updateOracleTurn(streamId, partial),
      });
      updateOracleTurn(streamId, reply);
      speakReply(reply);
    } catch {
      if (!controller.signal.aborted) {
        const fallback = reactToFreeText(trimmed, context);
        updateOracleTurn(streamId, fallback);
        speakReply(fallback);
      }
    } finally {
      setThinking(false);
      setStreamingTurnId(null);
    }
  }

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
    submitQuery(draft);
  }

  function handleCoinSearch(symbol: string) {
    submitQuery(`scan ${symbol}`);
  }

  function handleCheckIn() {
    setAwaitingDayReply(false);
    markIntroWelcomeSpoken();
    appendOracle("I'm here — markets, strategy, life, whatever you need. Talk to me.");
  }

  const visibleTurns = turns;

  return (
    <div
      className={`oracle-chat oracle-chat--${variant}${minimal ? " oracle-chat--minimal" : ""}${speaking ? " oracle-chat--speaking" : ""}`}
      role="region"
      aria-label={`Conversation with ${context.titanBotName}`}
    >
      {!minimal ? (
        <div className="oracle-chat__head">
          <div className="oracle-chat__avatar" aria-hidden="true">
            <span className="oracle-chat__avatar-ring" />
            <SynexusSymbolMark size="chat" />
          </div>
          <div>
            <p className="oracle-chat__name">{context.titanBotName}</p>
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

      <div className="oracle-chat__thread" aria-live="polite" ref={threadRef}>
        {visibleTurns.length === 0 ? (
          <div className="oracle-chat__empty-wrap">
            <p className="oracle-chat__empty">
              {minimal
                ? `Message ${context.titanBotName} — crypto, advice, or anything on your mind.`
                : `Talk to ${context.titanBotName} about anything — markets, decisions, or what you're working through.`}
            </p>
            {!minimal ? (
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

      {!minimal && coinQuickPicks.length ? (
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
              onClick={() => submitQuery("Aegis security and privacy")}
            >
              Security &amp; privacy
            </button>
            <button
              type="button"
              className="oracle-chat__chip oracle-chat__chip--coin"
              onClick={() => submitQuery("sentinel status")}
            >
              Sentinel status
            </button>
            <button
              type="button"
              className="oracle-chat__chip oracle-chat__chip--coin"
              onClick={() => submitQuery("what can you do")}
            >
              What can you do?
            </button>
          </div>
        </div>
      ) : null}

      {!minimal && awaitingDayReply ? (
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
          placeholder={
            minimal
              ? `Message ${context.titanBotName}…`
              : `Talk to ${context.titanBotName} — anything on your mind…`
          }
          aria-label={`Message to ${context.titanBotName}`}
          disabled={thinking}
        />
        <button type="submit" disabled={!draft.trim() || thinking}>
          {thinking ? "…" : "Send"}
        </button>
      </form>

      {isTitanVoiceSupported() ? (
        <div className="oracle-chat__voice-row">
          <button
            type="button"
            className={`oracle-chat__voice-btn${speaking || isTitanSpeaking() ? " oracle-chat__voice-btn--stop" : ""}`}
            onClick={() => {
              if (speaking || isTitanSpeaking()) {
                stopTitanSpeech();
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

      {!minimal && visibleTurns.length > 0 && hasTitanFeedbackConsent() ? (
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

      {minimal ? (
        <TitanChatSettings titanBotName={context.titanBotName} voiceOnly />
      ) : (
        <TitanChatSettings titanBotName={context.titanBotName} />
      )}
    </div>
  );
}
