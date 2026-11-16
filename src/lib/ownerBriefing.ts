import { getAccessToken } from "./authSession";

export type OwnerBriefing = {
  spoken: string;
  detail: string;
};

const BRIEF_ASK =
  /\b(daily report|owner briefing|owner brief|business report|how(?:'s| is) the (?:business|company)|subscription revenue)\b/i;

export function isOwnerBriefRequest(text: string): boolean {
  return BRIEF_ASK.test(text);
}

/** Owner-only. Returns null for everyone else, including when the server cannot verify the session. */
export async function fetchOwnerBrief(): Promise<OwnerBriefing | null> {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const response = await fetch("/api/owner/brief", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { spoken?: unknown; detail?: unknown };
    if (typeof data.spoken !== "string" || typeof data.detail !== "string") return null;
    if (!data.spoken.includes("Data unavailable")) return null;
    return { spoken: data.spoken, detail: data.detail };
  } catch {
    return null;
  }
}
