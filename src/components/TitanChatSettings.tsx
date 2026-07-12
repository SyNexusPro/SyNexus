import { useState } from "react";
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

type Props = {
  titanBotName: string;
  /** Titan sheet: voice toggle only */
  voiceOnly?: boolean;
};

export function TitanChatSettings({ titanBotName, voiceOnly = false }: Props) {
  const [memoryOn, setMemoryOn] = useState(hasTitanMemoryConsent);
  const [feedbackOn, setFeedbackOn] = useState(hasTitanFeedbackConsent);
  const [voiceOn, setVoiceOn] = useState(hasTitanVoiceEnabled);
  const voiceSupported = isTitanVoiceSupported();

  return (
    <div className="titan-chat-settings" aria-label={`${titanBotName} preferences`}>
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
              }}
            />
            <span>
              Personalized memory — {titanBotName} remembers favorites &amp; risk style (optional)
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
