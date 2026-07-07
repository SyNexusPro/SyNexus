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

type Props = {
  titanBotName: string;
};

export function TitanChatSettings({ titanBotName }: Props) {
  const [memoryOn, setMemoryOn] = useState(hasTitanMemoryConsent);
  const [feedbackOn, setFeedbackOn] = useState(hasTitanFeedbackConsent);

  return (
    <div className="titan-chat-settings" aria-label={`${titanBotName} preferences`}>
      <p className="titan-chat-settings__disclaimer">{TITAN_GUARDRAILS.disclaimer}</p>
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
    </div>
  );
}
