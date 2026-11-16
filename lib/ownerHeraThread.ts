export type OwnerHeraTurn = {
  id: string;
  role: "oracle" | "user";
  text: string;
  at: number;
  responseId?: string;
};

const MAX_TURNS = 40;
const MAX_TEXT = 4_000;

export function sanitizeOwnerHeraTurns(input: unknown): OwnerHeraTurn[] {
  if (!Array.isArray(input)) return [];
  const turns: OwnerHeraTurn[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const role = row.role === "user" || row.role === "oracle" ? row.role : null;
    const text = typeof row.text === "string" ? row.text.trim().slice(0, MAX_TEXT) : "";
    const at = typeof row.at === "number" && Number.isFinite(row.at) ? row.at : 0;
    const id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 80) : "";
    if (!role || !text || !id) continue;
    const responseId = typeof row.responseId === "string" ? row.responseId.slice(0, 80) : undefined;
    turns.push({ id, role, text, at, ...(responseId ? { responseId } : {}) });
  }
  return turns.slice(-MAX_TURNS);
}

export function latestTurnAt(turns: OwnerHeraTurn[]): number {
  return turns.reduce((latest, turn) => Math.max(latest, turn.at || 0), 0);
}

/** Keep whichever copy has the newest turn. Equal timestamps keep the local copy. */
export function pickNewerOwnerHeraTurns(local: OwnerHeraTurn[], remote: OwnerHeraTurn[]): OwnerHeraTurn[] {
  return latestTurnAt(remote) > latestTurnAt(local) ? remote : local;
}
