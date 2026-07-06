import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildOracleSupremeSpeakScript,
  createOracleSupremeSpeaker,
  isOracleSupremeVoiceSupported,
} from "../lib/oracleSupremeVoice";
import { resolveTitanBotName } from "../lib/titanBotName";
import type { OracleSupremeDailyReport } from "../data/syntheticWatchers";

type OracleSupremeVoiceBarProps = {
  plan: "FREE" | "PRO";
  briefing: string;
  report?: OracleSupremeDailyReport;
  titanBotName?: string;
  onSpeakingChange?: (speaking: boolean) => void;
};

export function OracleSupremeVoiceBar({
  plan,
  briefing,
  report,
  titanBotName,
  onSpeakingChange,
}: OracleSupremeVoiceBarProps) {
  const commanderName = titanBotName ?? resolveTitanBotName();
  const supported = isOracleSupremeVoiceSupported();
  const [speaking, setSpeaking] = useState(false);
  const speakerRef = useRef<ReturnType<typeof createOracleSupremeSpeaker> | null>(null);

  const script = useMemo(
    () =>
      buildOracleSupremeSpeakScript(
        plan === "PRO" ? "full" : "sample",
        briefing,
        plan === "PRO" ? report : undefined,
        commanderName,
      ),
    [briefing, commanderName, plan, report],
  );

  useEffect(() => {
    onSpeakingChange?.(speaking);
  }, [onSpeakingChange, speaking]);

  useEffect(() => {
    speakerRef.current = createOracleSupremeSpeaker({
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });

    return () => {
      speakerRef.current?.stop();
    };
  }, []);

  if (!supported) {
    return (
      <p className="oracle-supreme-voice oracle-supreme-voice--unsupported">
        Voice briefings need a browser that supports speech. Try Chrome or Safari on your phone.
      </p>
    );
  }

  function handleToggle() {
    if (speaking) {
      speakerRef.current?.stop();
      setSpeaking(false);
      return;
    }
    speakerRef.current?.speak(script);
  }

  return (
    <div
      className={`oracle-supreme-voice${speaking ? " oracle-supreme-voice--active" : ""}`}
      role="region"
      aria-label={`${commanderName} voice briefing`}
    >
      <div className="oracle-supreme-voice__wave" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} style={{ animationDelay: `${index * 0.12}s` }} />
        ))}
      </div>
      <div className="oracle-supreme-voice__text">
        <p className="oracle-supreme-voice__title">
          {speaking ? `${commanderName} is speaking…` : `Hear ${commanderName}`}
        </p>
        <p className="oracle-supreme-voice__hint">
          {plan === "PRO"
            ? `${commanderName} will read your full private briefing aloud.`
            : `Sample ${commanderName}'s voice — Pro unlocks full spoken briefings.`}
        </p>
      </div>
      <button
        type="button"
        className="oracle-supreme-voice__button"
        onClick={handleToggle}
        aria-pressed={speaking}
      >
        {speaking ? "Stop" : "Listen"}
      </button>
    </div>
  );
}
