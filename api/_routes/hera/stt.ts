/**
 * High-quality speech-to-text for Hera (OpenAI gpt-4o-transcribe / Whisper).
 * Keys stay server-side.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "../viteDevServer";

const STT_PROMPT =
  "Transcribe the speaker exactly. Include Hera, Titan, SyNexus, Solana, Bitcoin, Ethereum, and everyday English. Do not rewrite or summarize.";

const MODELS = ["gpt-4o-transcribe", "gpt-4o-mini-transcribe", "whisper-1"] as const;

function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function extensionForMime(mime: string): string {
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

async function transcribeWithOpenAi(
  apiKey: string,
  audio: Buffer,
  mime: string,
): Promise<string | null> {
  const filename = `speech.${extensionForMime(mime)}`;
  const preferred = sttEnv.OPENAI_STT_MODEL?.trim() || process.env.OPENAI_STT_MODEL?.trim();
  const models = preferred ? [preferred, ...MODELS.filter((m) => m !== preferred)] : [...MODELS];

  for (const model of models) {
    const form = new FormData();
    const bytes = new Uint8Array(audio);
    const file =
      typeof File !== "undefined"
        ? new File([bytes], filename, { type: mime || "audio/webm" })
        : new Blob([bytes], { type: mime || "audio/webm" });
    form.append("file", file, filename);
    form.append("model", model);
    form.append("language", "en");
    form.append("prompt", STT_PROMPT);
    form.append("response_format", "json");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) continue;
    const json = (await res.json()) as { text?: string };
    const text = typeof json.text === "string" ? json.text.trim() : "";
    if (text) return text;
  }
  return null;
}

let sttEnv: Record<string, string | undefined> = process.env;

export async function handleHeraStt(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.end();
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const apiKey = sttEnv.OPENAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    sendJson(res, 501, { error: "Speech transcription is not configured." });
    return;
  }

  try {
    const raw = await readRawBody(req);
    const parsed = JSON.parse(raw.toString("utf8") || "{}") as {
      audioBase64?: string;
      mimeType?: string;
    };
    const audioBase64 = typeof parsed.audioBase64 === "string" ? parsed.audioBase64.trim() : "";
    const mimeType = typeof parsed.mimeType === "string" ? parsed.mimeType.trim() : "audio/webm";
    if (!audioBase64) {
      sendJson(res, 400, { error: "audio required" });
      return;
    }
    if (audioBase64.length > 2_500_000) {
      sendJson(res, 413, { error: "Recording is too long. Tap to speak again." });
      return;
    }

    const audio = Buffer.from(audioBase64, "base64");
    if (audio.length < 800) {
      sendJson(res, 400, { error: "I didn't catch that — tap and speak again." });
      return;
    }

    const text = await transcribeWithOpenAi(apiKey, audio, mimeType);
    if (!text) {
      sendJson(res, 502, { error: "Couldn't transcribe that. Tap and speak again." });
      return;
    }

    sendJson(res, 200, { text });
  } catch (err) {
    console.error("[hera/stt]", err);
    sendJson(res, 500, { error: "Transcription failed." });
  }
}

export function configureHeraSttApi(
  server: ViteDevServer,
  env?: Record<string, string | undefined>,
): void {
  if (env) sttEnv = { ...process.env, ...env };
  server.middlewares.use("/api/hera/stt", async (req, res, next) => {
    const method = (req as IncomingMessage).method;
    if (method !== "POST" && method !== "OPTIONS") {
      next();
      return;
    }
    await handleHeraStt(req as IncomingMessage, res as ServerResponse);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleHeraStt(req, res);
}
