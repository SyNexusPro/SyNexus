import { useMemo, useState } from "react";
import type { ConversationTurn } from "../lib/oracleSupremeConversation";
import {
  deleteChatArchive,
  formatArchiveWhen,
  loadChatLibrary,
  type TitanChatArchive,
} from "../lib/titanChatLibrary";

type Props = {
  onBack: () => void;
  onOpenArchive: (archive: TitanChatArchive) => void;
};

export function TitanChatLibrary({ onBack, onOpenArchive }: Props) {
  const [entries, setEntries] = useState(() => loadChatLibrary());
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const empty = entries.length === 0;

  function refresh() {
    setEntries(loadChatLibrary());
  }

  function handleDelete(id: string) {
    deleteChatArchive(id);
    setConfirmId(null);
    refresh();
  }

  return (
    <div className="titan-library">
      <div className="titan-library__toolbar">
        <button type="button" className="titan-library__back" onClick={onBack}>
          ← New chat
        </button>
        <p className="titan-library__hint">Saved up to 6 months · closes start fresh</p>
      </div>

      {empty ? (
        <div className="titan-library__empty">
          <p>No saved conversations yet.</p>
          <p>When you close Titan, chats with your messages are filed here.</p>
        </div>
      ) : (
        <ul className="titan-library__list">
          {entries.map((entry) => (
            <li key={entry.id} className="titan-library__item">
              <button
                type="button"
                className="titan-library__open"
                onClick={() => onOpenArchive(entry)}
              >
                <span className="titan-library__title">{entry.title}</span>
                <span className="titan-library__meta">{formatArchiveWhen(entry.archivedAt)}</span>
                {entry.preview ? <span className="titan-library__preview">{entry.preview}</span> : null}
              </button>
              {confirmId === entry.id ? (
                <div className="titan-library__confirm">
                  <button type="button" onClick={() => handleDelete(entry.id)}>
                    Delete
                  </button>
                  <button type="button" onClick={() => setConfirmId(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="titan-library__delete"
                  aria-label="Delete conversation"
                  onClick={() => setConfirmId(entry.id)}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type ArchiveViewProps = {
  archive: TitanChatArchive;
  titanBotName: string;
  onBack: () => void;
};

export function TitanChatArchiveView({ archive, titanBotName, onBack }: ArchiveViewProps) {
  const turns = useMemo(() => archive.turns, [archive.turns]);

  return (
    <div className="titan-library titan-library--view">
      <div className="titan-library__toolbar">
        <button type="button" className="titan-library__back" onClick={onBack}>
          ← Library
        </button>
        <p className="titan-library__hint">{formatArchiveWhen(archive.archivedAt)} · read only</p>
      </div>
      <h3 className="titan-library__view-title">{archive.title}</h3>
      <div className="titan-library__thread" role="log" aria-label="Archived conversation">
        {turns.map((turn) => (
          <ArchiveBubble key={turn.id} turn={turn} titanBotName={titanBotName} />
        ))}
      </div>
    </div>
  );
}

function ArchiveBubble({
  turn,
  titanBotName,
}: {
  turn: ConversationTurn;
  titanBotName: string;
}) {
  const isUser = turn.role === "user";
  return (
    <article
      className={`titan-library__bubble titan-library__bubble--${isUser ? "user" : "oracle"}`}
    >
      <p className="titan-library__bubble-role">{isUser ? "You" : titanBotName}</p>
      <p className="titan-library__bubble-text">{turn.text}</p>
    </article>
  );
}
