import { authHeaders } from "./authSession";

export type HeraMindState = {
  available: boolean;
  personalMemory: boolean;
  sharedLearning: boolean;
  personalNotes: string[];
  sharedLessons: string[];
  proposals: { id: string; lesson: string }[];
};

async function postMind(body: Record<string, unknown>): Promise<boolean> {
  const response = await fetch("/api/hera/mind", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  return response.ok;
}

export async function fetchHeraMind(): Promise<HeraMindState | null> {
  const response = await fetch("/api/hera/mind", { headers: await authHeaders(), cache: "no-store" });
  if (!response.ok) return null;
  return (await response.json()) as HeraMindState;
}

export async function saveHeraMindConsent(personalMemory: boolean, sharedLearning: boolean): Promise<boolean> {
  return postMind({ action: "consent", personalMemory, sharedLearning });
}

export async function forgetHeraPersonalMemory(): Promise<boolean> {
  return postMind({ action: "forget" });
}

export async function decideHeraSharedLesson(id: string, approve: boolean): Promise<boolean> {
  return postMind({ action: "decide", id, approve });
}
