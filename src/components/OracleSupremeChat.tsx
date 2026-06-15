import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildFollowUpAfterMood,
  buildOpeningGreeting,
  createTurn,
  type ConversationTurn,
  type DayMoodReply,
  type OracleConversationContext,
  loadConversationHistory,
  markIntroWelcomeSpoken,
  reactToFreeText,
  saveConversationHistory,
  wasIntroWelcomeSpoken,
  ORACLE_INTRO_VOICE_LINE,
  DAY_MOOD_QUICK_REPLIES,
} from "../lib/oracleSupremeConversation";
import { createOracleSupremeSpeaker, isOracleSupremeVoiceSupported } from "../lib/oracleSupremeVoice";
import { guardOracleChat } from "../lib/securityBot";
import { SynexusSymbolMark } from "./SynexusSymbolMark";

type OracleSupremeChatProps = {
  context: OracleConversationContext;
  variant?: "overlay" | "inline" | "widget";
  autoSpeak?: boolean;
  showOpeningPrompt?: boolean;
  onDismiss?: () => void;
  onSpeakingChange?: (speaking: boolean) => void;
};

export function OracleSupremeChat({
  context,
  variant = "inline",
  autoSpeak = false,
  showOpeningPrompt = false,
  onDismiss,
  onSpeakingChange,
}: OracleSupremeChatProps) {
  const [turns, setTurns] = useState<ConversationTurn[]>(() => loadConversationHistory());
  const [draft, setDraft] = useState("");
  const [awaitingDayReply, setAwaitingDayReply] = useState(showOpeningPrompt);
  const [speaking, setSpeaking] = useState(false);
  const speakerRef = useRef<ReturnType<typeof createOracleSupremeSpeaker> | null>(null);
  const autoSpokeRef = useRef(false);
  const voiceSupported = isOracleSupremeVoiceSupported();

  const openingLine = useMemo(
    () => buildOpeningGreeting(context, { skipWelcomeLine: wasIntroWelcomeSpoken() }),
    [context],
  );

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
    appendUser(trimmed);
    appendOracle(reactToFreeText(trimmed, context), { speak: false });
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
      return;
    }

    appendOracle(openingLine, { speak: autoSpeak && !wasIntroWelcomeSpoken() });
  }, [appendOracle, autoSpeak, openingLine, showOpeningPrompt]);

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
    setAwaitingDayReply(true);
    if (!wasIntroWelcomeSpoken()) markIntroWelcomeSpoken();
    appendOracle(openingLine, { speak: true });
  }

  function handleStopVoice() {
    speakerRef.current?.stop();
    setSpeaking(false);
    onSpeakingChange?.(false);
  }

  const visibleTurns = turns;

  return (
    <div
      className={`oracle-chat oracle-chat--${variant}${speaking ? " oracle-chat--speaking" : ""}`}
      role="region"
      aria-label="Conversation with Oracle Supreme"
    >
      <div className="oracle-chat__head">
        <div className="oracle-chat__avatar" aria-hidden="true">
          <span className="oracle-chat__avatar-ring" />
          <SynexusSymbolMark size="chat" />
        </div>
        <div>
          <p className="oracle-chat__name">Oracle Supreme</p>
          <p className="oracle-chat__status">
            {speaking
              ? "Speaking…"
              : context.tokens.length
                ? `${context.tokens.length} coins · ${context.feedSource} feed`
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

      <div className="oracle-chat__thread" aria-live="polite">
        {visibleTurns.length === 0 && !showOpeningPrompt ? (
          <div className="oracle-chat__empty-wrap">
            <p className="oracle-chat__empty">
              Say hello — Oracle will greet you by name and check in on your day.
            </p>
            <button type="button" className="oracle-chat__chip" onClick={handleCheckIn}>
              Check in with me
            </button>
          </div>
        ) : null}
        {visibleTurns.map((turn) => (
          <div key={turn.id} className={`oracle-chat__bubble oracle-chat__bubble--${turn.role}`}>
            {turn.text}
          </div>
        ))}
      </div>

      {coinQuickPicks.length ? (
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
              onClick={() => submitQuery("sentinel status")}
            >
              Sentinel status
            </button>
          </div>
        </div>
      ) : null}

      {awaitingDayReply ? (
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
          placeholder={`Search a coin or ask Oracle…`}
          aria-label="Message to Oracle Supreme"
        />
        <button type="submit" disabled={!draft.trim()}>
          Send
        </button>
      </form>

      {voiceSupported ? (
        <div className="oracle-chat__voice-row">
          <button type="button" className="oracle-chat__voice-btn" onClick={() => speak(ORACLE_INTRO_VOICE_LINE)}>
            Replay welcome
          </button>
          <button type="button" className="oracle-chat__voice-btn" onClick={() => speak(openingLine)}>
            Replay greeting
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
    </div>
  );
}
