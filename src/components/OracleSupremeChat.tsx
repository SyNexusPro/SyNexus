import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildFollowUpAfterMood,
  buildOracleIntroVoiceLine,
  createTurn,
  type ConversationTurn,
  type DayMoodReply,
  type OracleConversationContext,
  loadConversationHistory,
  markIntroWelcomeSpoken,
  reactToFreeText,
  saveConversationHistory,
  wasIntroWelcomeSpoken,
  DAY_MOOD_QUICK_REPLIES,
} from "../lib/oracleSupremeConversation";
import { createOracleSupremeSpeaker, isOracleSupremeVoiceSupported } from "../lib/oracleSupremeVoice";
import { guardOracleChat } from "../lib/securityBot";
import { recordTitanFeedback, hasTitanFeedbackConsent } from "../lib/titanFeedback";
import { TitanChatSettings } from "./TitanChatSettings";
import { SynexusSymbolMark } from "./SynexusSymbolMark";

type OracleSupremeChatProps = {
  context: OracleConversationContext;
  variant?: "overlay" | "inline" | "widget";
  /** Titan sheet: thread + composer only — no chips, settings, or duplicate chrome. */
  minimal?: boolean;
  showOpeningPrompt?: boolean;
  onDismiss?: () => void;
  onSpeakingChange?: (speaking: boolean) => void;
};

export function OracleSupremeChat({
  context,
  variant = "inline",
  minimal = false,
  showOpeningPrompt = false,
  onDismiss,
  onSpeakingChange,
}: OracleSupremeChatProps) {
  const [turns, setTurns] = useState<ConversationTurn[]>(() => loadConversationHistory());
  const [draft, setDraft] = useState("");
  const [awaitingDayReply, setAwaitingDayReply] = useState(showOpeningPrompt);
  const [speaking, setSpeaking] = useState(false);
  const [lastUserTopic, setLastUserTopic] = useState("");
  const speakerRef = useRef<ReturnType<typeof createOracleSupremeSpeaker> | null>(null);
  const autoSpokeRef = useRef(false);
  const voiceSupported = isOracleSupremeVoiceSupported();

  const coinQuickPicks = useMemo(() => {
    const trending = [...context.tokens]
      .sort((a, b) => Math.abs(b.change24hPct) - Math.abs(a.change24hPct))
      .slice(0, 4);
    return trending.map((t) => t.symbol);
  }, [context.tokens]);

  function submitQuery(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const security = guardOracleChat(trimmed);
    if (!security.allowed) {
      appendOracle(security.message ?? "Message blocked by Synexus security.", { speak: false });
      return;
    }

    setDraft("");
    setAwaitingDayReply(false);
    setLastUserTopic(trimmed);
    appendUser(trimmed);
    appendOracle(reactToFreeText(trimmed, context), { speak: true });
  }

  useEffect(() => {
    speakerRef.current = createOracleSupremeSpeaker({
      onStart: () => {
        setSpeaking(true);
        onSpeakingChange?.(true);
      },
      onEnd: () => {
        setSpeaking(false);
        onSpeakingChange?.(false);
      },
      onError: () => {
        setSpeaking(false);
        onSpeakingChange?.(false);
      },
    });
    return () => speakerRef.current?.stop();
  }, [onSpeakingChange]);

  const speak = useCallback(
    (text: string) => {
      if (!voiceSupported) return;
      speakerRef.current?.speak(text);
    },
    [voiceSupported],
  );

  const appendOracle = useCallback(
    (text: string, options?: { speak?: boolean }) => {
      setTurns((prev) => {
        const next = [...prev, createTurn("oracle", text)];
        saveConversationHistory(next);
        return next;
      });
      if (options?.speak !== false) speak(text);
    },
    [speak],
  );

  const appendUser = useCallback((text: string) => {
    setTurns((prev) => {
      const next = [...prev, createTurn("user", text)];
      saveConversationHistory(next);
      return next;
    });
  }, []);

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
    appendUser(label);
    setAwaitingDayReply(false);
    appendOracle(buildFollowUpAfterMood(mood, context), { speak: false });
  }

  function handleSend() {
    submitQuery(draft);
  }

  function handleCoinSearch(symbol: string) {
    submitQuery(`scan ${symbol}`);
  }

  function handleCheckIn() {
    setAwaitingDayReply(false);
    if (wasIntroWelcomeSpoken()) {
      appendOracle("I'm listening. Ask about any coin or tell me what you need.", { speak: false });
      return;
    }
    markIntroWelcomeSpoken();
    appendOracle(buildOracleIntroVoiceLine(null, context.titanBotName), { speak: true });
  }

  function handleStopVoice() {
    speakerRef.current?.stop();
    setSpeaking(false);
    onSpeakingChange?.(false);
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
              {speaking
                ? "Speaking…"
                : context.tokens.length
                  ? `Live feed · ask ${context.titanBotName}, not the menus`
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

      <div className="oracle-chat__thread" aria-live="polite">
        {visibleTurns.length === 0 ? (
          <div className="oracle-chat__empty-wrap">
            <p className="oracle-chat__empty">
              {minimal
                ? `Message ${context.titanBotName} below.`
                : `Ask ${context.titanBotName} — scans, risk reads, and coaching. Tap when you're ready.`}
            </p>
            {!minimal ? (
              <button type="button" className="oracle-chat__chip" onClick={handleCheckIn}>
                Start talking
              </button>
            ) : null}
          </div>
        ) : null}
        {visibleTurns.map((turn) => (
          <div key={turn.id} className={`oracle-chat__bubble oracle-chat__bubble--${turn.role}`}>
            {turn.text}
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
              : `Ask ${context.titanBotName} — scan a coin, explain risk, coach a decision…`
          }
          aria-label={`Message to ${context.titanBotName}`}
        />
        <button type="submit" disabled={!draft.trim()}>
          Send
        </button>
      </form>

      {!minimal && voiceSupported ? (
        <div className="oracle-chat__voice-row">
          <button
            type="button"
            className="oracle-chat__voice-btn"
            onClick={() => speak(buildOracleIntroVoiceLine(null, context.titanBotName))}
          >
            Replay welcome
          </button>
          {speaking ? (
            <button
              type="button"
              className="oracle-chat__voice-btn oracle-chat__voice-btn--stop"
              onClick={handleStopVoice}
            >
              Stop voice
            </button>
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

      {!minimal ? <TitanChatSettings titanBotName={context.titanBotName} /> : null}
    </div>
  );
}
