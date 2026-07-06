import { useState } from "react";
import { DEFAULT_TITAN_BOT_NAME } from "../config/titanBot";
import { useTitanBotName } from "../hooks/useTitanBotName";
import { normalizeTitanBotName } from "../lib/titanBotName";
import { updateTitanBotName } from "../lib/supabaseData";
import { useOperatorAuth } from "../hooks/useOperatorAuth";

type Props = {
  className?: string;
  compact?: boolean;
};

export function TitanBotRename({ className = "", compact = false }: Props) {
  const { name, setName, resetName, isCustom } = useTitanBotName();
  const { userId, linked } = useOperatorAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function beginEdit() {
    setDraft(name);
    setError(null);
    setEditing(true);
  }

  async function commitEdit() {
    const normalized = normalizeTitanBotName(draft);
    if (!normalized) {
      setError(`Use ${2}–24 letters or numbers.`);
      return;
    }
    setSaving(true);
    setError(null);
    setName(normalized);
    if (linked && userId) {
      try {
        await updateTitanBotName(userId, normalized);
      } catch {
        /* local name still saved */
      }
    }
    setSaving(false);
    setEditing(false);
  }

  function cancelEdit() {
    setDraft(name);
    setError(null);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className={`titan-bot-rename titan-bot-rename--edit${className ? ` ${className}` : ""}`}>
        <label className="titan-bot-rename__label" htmlFor="titan-bot-name-input">
          Name your synthetic bot
        </label>
        <div className="titan-bot-rename__row">
          <input
            id="titan-bot-name-input"
            className="titan-bot-rename__input"
            value={draft}
            maxLength={24}
            disabled={saving}
            autoComplete="off"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void commitEdit();
              if (event.key === "Escape") cancelEdit();
            }}
          />
          <button type="button" className="titan-bot-rename__save" disabled={saving} onClick={() => void commitEdit()}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" className="titan-bot-rename__cancel" disabled={saving} onClick={cancelEdit}>
            Cancel
          </button>
        </div>
        {error ? (
          <p className="titan-bot-rename__error" role="alert">
            {error}
          </p>
        ) : (
          <p className="titan-bot-rename__hint">Only {DEFAULT_TITAN_BOT_NAME} can be renamed — Sentinels stay fixed.</p>
        )}
      </div>
    );
  }

  return (
    <div className={`titan-bot-rename${className ? ` ${className}` : ""}`}>
      <p className="titan-bot-rename__current">
        <span className="titan-bot-rename__name">{name}</span>
        {!compact ? <span className="titan-bot-rename__tag">your synthetic bot</span> : null}
      </p>
      <div className="titan-bot-rename__actions">
        <button type="button" className="titan-bot-rename__edit" onClick={beginEdit}>
          Rename {DEFAULT_TITAN_BOT_NAME}
        </button>
        {isCustom ? (
          <button type="button" className="titan-bot-rename__reset" onClick={() => resetName()}>
            Reset to {DEFAULT_TITAN_BOT_NAME}
          </button>
        ) : null}
      </div>
    </div>
  );
}
