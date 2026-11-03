/**
 * Retrieves previous Hera research and Alexus trade-pattern notes from Supabase pgvector.
 * Stores nothing when the embedding key or the table is missing. Never invents a match.
 */
import crypto from "node:crypto";
import { supabaseAdminFromEnv } from "../titan/authPlan.js";

export type MemoryKind = "research" | "trade_pattern" | "lesson";

export type MemoryHit = {
  kind: MemoryKind;
  source: string;
  content: string;
  similarity: number | null;
};

type Env = Record<string, string | undefined>;
type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

const EMBED_MODEL = "text-embedding-3-small";

export async function embedText(env: Env, text: string, fetchImpl: FetchImpl = fetch): Promise<number[] | null> {
  const key = env.OPENAI_API_KEY?.trim();
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!key || cleaned.length < 8) return null;
  const response = await fetchImpl("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: cleaned.slice(0, 4000) }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return null;
  const body = await response.json() as { data?: { embedding?: unknown }[] };
  const embedding = body.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length < 8 || embedding.some((n) => typeof n !== "number")) return null;
  return embedding as number[];
}

export function formatMemoryHits(hits: MemoryHit[] | "unavailable"): string {
  if (hits === "unavailable") {
    return "PREVIOUS RESEARCH unavailable. The memory store was not read. Do not invent past results or trade patterns.";
  }
  if (!hits.length) {
    return "PREVIOUS RESEARCH is empty for this question. Do not invent a historical pattern.";
  }
  const lines = hits.slice(0, 4).map((hit) => {
    const similarity = hit.similarity === null ? "similarity not scored" : `similarity ${hit.similarity.toFixed(2)}`;
    return `- [${hit.kind}] ${hit.content} (${hit.source}, ${similarity})`;
  });
  return [
    "PREVIOUS RESEARCH (retrieved notes, not a new measurement):",
    ...lines,
    "These notes are not a live fill and not a permission to trade.",
  ].join("\n");
}

export async function recallMemory(env: Env, query: string, fetchImpl?: FetchImpl): Promise<MemoryHit[] | "unavailable"> {
  const admin = supabaseAdminFromEnv(env);
  if (!admin) return "unavailable";
  let embedding: number[] | null;
  try {
    embedding = await embedText(env, query, fetchImpl);
  } catch {
    return "unavailable";
  }
  if (!embedding) return "unavailable";
  const { data, error } = await admin.rpc("match_hera_memory", {
    query_embedding: embedding,
    match_count: 4,
    filter_kind: null,
  });
  if (error) {
    if (/PGRST205|42P01|PGRST202|does not exist/i.test(error.message)) return "unavailable";
    return "unavailable";
  }
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const rec = row as { kind?: unknown; source?: unknown; content?: unknown; similarity?: unknown };
    if (typeof rec.content !== "string" || !rec.content.trim()) return [];
    const kind: MemoryKind = rec.kind === "trade_pattern" || rec.kind === "lesson" || rec.kind === "research" ? rec.kind : "research";
    const similarity = typeof rec.similarity === "number" && Number.isFinite(rec.similarity) ? rec.similarity : null;
    return [{
      kind,
      source: typeof rec.source === "string" ? rec.source.slice(0, 80) : "memory",
      content: rec.content.replace(/\s+/g, " ").trim().slice(0, 400),
      similarity,
    }];
  });
}

export async function rememberText(
  env: Env,
  input: { kind: MemoryKind; source: string; content: string },
  fetchImpl?: FetchImpl,
): Promise<"stored" | "skipped"> {
  const content = input.content.replace(/\s+/g, " ").trim().slice(0, 2000);
  if (content.length < 8) return "skipped";
  const admin = supabaseAdminFromEnv(env);
  if (!admin) return "skipped";
  let embedding: number[] | null;
  try {
    embedding = await embedText(env, content, fetchImpl);
  } catch {
    return "skipped";
  }
  if (!embedding) return "skipped";
  const contentHash = crypto.createHash("sha256").update(`${input.kind}:${content}`).digest("hex");
  const { error } = await admin.from("hera_memory").upsert({
    kind: input.kind,
    source: input.source.slice(0, 80),
    content,
    content_hash: contentHash,
    embedding,
  }, { onConflict: "kind,content_hash", ignoreDuplicates: true });
  if (error) return "skipped";
  return "stored";
}

export function lessonTextFromSnapshot(snapshot: unknown): string {
  const snap = snapshot && typeof snapshot === "object" ? snapshot as Record<string, unknown> : {};
  const lessons = snap.alexusLessons && typeof snap.alexusLessons === "object"
    ? (snap.alexusLessons as { lines?: unknown }).lines
    : undefined;
  const lines = Array.isArray(lessons) ? lessons.filter((line): line is string => typeof line === "string") : [];
  return lines.join(" ").replace(/\s+/g, " ").trim().slice(0, 2000);
}
