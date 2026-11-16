import { useEffect, useState } from "react";
import { useHeraVersion } from "../hooks/useHeraVersion";
import { TITAN_GUARDRAILS } from "../config/titanGuidelines";
import {
  hasTitanMemoryConsent,
  setTitanMemoryConsent,
} from "../lib/titanMemory";
import {
  hasTitanFeedbackConsent,
  setTitanFeedbackConsent,
} from "../lib/titanFeedback";
import {
  hasTitanVoiceEnabled,
  isTitanVoiceSupported,
  setTitanVoiceEnabled,
} from "../lib/titanVoice";
import { fetchHeraMind, forgetHeraPersonalMemory, saveHeraMindConsent } from "../lib/heraMind";
import { useHeraWakeWordSetting } from "../hooks/useHeraWakeWordSetting";

type Props = {
  titanBotName: string;
  /** Titan sheet: voice toggle only */
  voiceOnly?: boolean;
};

export function TitanChatSettings({ titanBotName, voiceOnly = false }: Props) {
  const { labeledName } = useHeraVersion(titanBotName);
  const [memoryOn, setMemoryOn] = useState(hasTitanMemoryConsent);
  const [sharedOn, setSharedOn] = useState(false);
  const [feedbackOn, setFeedbackOn] = useState(hasTitanFeedbackConsent);
  const [voiceOn, setVoiceOn] = useState(hasTitanVoiceEnabled);
  const { enabled: wakeOn, toggle: toggleWake } = useHeraWakeWordSetting();
  const voiceSupported = isTitanVoiceSupported();

  useEffect(() => {
    void fetchHeraMind().then((mind) => {
      if (!mind) return;
      setMemoryOn(mind.personalMemory);
      setSharedOn(mind.sharedLearning);
      setTitanMemoryConsent(mind.personalMemory);
    });
  }, []);

  return (
    <div className="titan-chat-settings" aria-label={`${titanBotName} preferences`}>
      <p className="titan-chat-settings__generation">
        {labeledName}
      </p>
      {!voiceOnly ? <p className="titan-chat-settings__disclaimer">{TITAN_GUARDRAILS.disclaimer}</p> : null}
      {voiceSupported ? (
        <label className="titan-chat-settings__toggle">
          <input
            type="checkbox"
            checked={voiceOn}
            onChange={(event) => {
              const on = event.target.checked;
              setTitanVoiceEnabled(on);
              setVoiceOn(on);
            }}
          />
          <span>
            {voiceOnly ? "Auto-speak — soft female voice" : "Titan voice — soft female, auto-speak replies"}
          </span>
        </label>
      ) : null}
      <label className="titan-chat-settings__toggle">
        <input
          type="checkbox"
          checked={wakeOn}
          onChange={() => toggleWake()}
        />
        <span>Listen for “Hera” — also under Hera Listen on Pulse</span>
      </label>
      {!voiceOnly ? (
        <>
          <label className="titan-chat-settings__toggle">
            <input
              type="checkbox"
              checked={memoryOn}
            onChange={(event) => {
              const on = event.target.checked;
              setTitanMemoryConsent(on);
              setMemoryOn(on);
              if (!on) void forgetHeraPersonalMemory();
              else void saveHeraMindConsent(true, sharedOn);
            }}
          />
          <span>
            Personal memory — {titanBotName} remembers this account across your devices. Turn it off to erase those notes.
          </span>
        </label>
        <label className="titan-chat-settings__toggle">
          <input
            type="checkbox"
            checked={sharedOn}
            onChange={(event) => {
              const on = event.target.checked;
              setSharedOn(on);
              void saveHeraMindConsent(memoryOn, on);
            }}
          />
          <span>
            Shared learning — let general lessons help every person. Private details stay out, and nothing is used until the owner approves it.
          </span>
        </label>
          <label className="titan-chat-settings__toggle">
            <input
              type="checkbox"
              checked={feedbackOn}
              onChange={(event) => {
                const on = event.target.checked;
                setTitanFeedbackConsent(on);
                setFeedbackOn(on);
              }}
            />
            <span>Anonymous feedback — help improve {titanBotName}&apos;s answers</span>
          </label>
        </>
      ) : null}
    </div>
  );
}
