import {
  clearConversationHistory,
  loadConversationHistory,
  type ConversationTurn,
} from "./oracleSupremeConversation";
import { recordHeraGrowth } from "./hera/growth";

export const TITAN_CHAT_LIBRARY_KEY = "synexus_titan_chat_library";

/** Retain archived Titan chats for six months. */
export const TITAN_CHAT_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

const MAX_LIBRARY_ENTRIES = 120;

export type TitanChatArchive = {
  id: string;
  title: string;
  preview: string;
  turns: ConversationTurn[];
  archivedAt: number;
  startedAt: number;
  userId?: string | null;
};

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `chat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function pruneLibrary(entries: TitanChatArchive[]): TitanChatArchive[] {
  const cutoff = Date.now() - TITAN_CHAT_RETENTION_MS;
  return entries
    .filter((entry) => entry.archivedAt >= cutoff)
    .sort((a, b) => b.archivedAt - a.archivedAt)
    .slice(0, MAX_LIBRARY_ENTRIES);
}

export function loadChatLibrary(): TitanChatArchive[] {
  try {
    const raw = localStorage.getItem(TITAN_CHAT_LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TitanChatArchive[];
    if (!Array.isArray(parsed)) return [];
    const pruned = pruneLibrary(
      parsed.filter(
        (entry) =>
          entry &&
          typeof entry.id === "string" &&
          Array.isArray(entry.turns) &&
          typeof entry.archivedAt === "number",
      ),
    );
    if (pruned.length !== parsed.length) {
      localStorage.setItem(TITAN_CHAT_LIBRARY_KEY, JSON.stringify(pruned));
    }
    return pruned;
  } catch {
    return [];
  }
}

function saveChatLibrary(entries: TitanChatArchive[]): void {
  try {
    localStorage.setItem(TITAN_CHAT_LIBRARY_KEY, JSON.stringify(pruneLibrary(entries)));
  } catch {
    /* quota / private mode */
  }
}

function titleFromTurns(turns: ConversationTurn[]): string {
  const firstUser = turns.find((turn) => turn.role === "user" && turn.text.trim());
  if (firstUser) {
    const text = firstUser.text.trim().replace(/\s+/g, " ");
    return text.length > 56 ? `${text.slice(0, 53)}…` : text;
  }
  return "Titan conversation";
}

function previewFromTurns(turns: ConversationTurn[]): string {
  const last = [...turns].reverse().find((turn) => turn.text.trim());
  if (!last) return "";
  const text = last.text.trim().replace(/\s+/g, " ");
  return text.length > 100 ? `${text.slice(0, 97)}…` : text;
}

/** Meaningful chat = at least one user message with content. */
export function conversationHasUserContent(turns: ConversationTurn[]): boolean {
  return turns.some((turn) => turn.role === "user" && turn.text.trim().length > 0);
}

/**
 * Archive the active Titan thread (if it has user content), then clear it
 * so the next open starts a fresh conversation.
 */
export function archiveActiveConversationAndReset(userId?: string | null): TitanChatArchive | null {
  const turns = loadConversationHistory();
  let archived: TitanChatArchive | null = null;

  if (conversationHasUserContent(turns)) {
    const startedAt = turns[0]?.at ?? Date.now();
    archived = {
      id: newId(),
      title: titleFromTurns(turns),
      preview: previewFromTurns(turns),
      turns,
      archivedAt: Date.now(),
      startedAt,
      userId: userId ?? null,
    };
    const library = loadChatLibrary();
    saveChatLibrary([archived, ...library]);
    recordHeraGrowth("archive");
  }

  clearConversationHistory();
  return archived;
}

export function getChatArchive(id: string): TitanChatArchive | null {
  return loadChatLibrary().find((entry) => entry.id === id) ?? null;
}

export function deleteChatArchive(id: string): void {
  saveChatLibrary(loadChatLibrary().filter((entry) => entry.id !== id));
}

export function formatArchiveWhen(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
