/**
 * Streaming ElevenLabs TTS + character alignment for Hera lip-sync.
 * ELEVENLABS_API_KEY stays server-side.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "../viteDevServer";

function readBody(req: IncomingMessage): Promise<{ text?: string }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? (JSON.parse(raw) as { text?: string }) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function writeNdjson(res: ServerResponse, row: unknown): void {
  res.write(`${JSON.stringify(row)}\n`);
}

const HERA_VOICE_SETTINGS = {
  stability: 0.74,
  similarity_boost: 0.78,
  style: 0.08,
  use_speaker_boost: true,
};

type ElAlignment = {
  chars?: string[];
  charStartTimesMs?: number[];
  charDurationsMs?: number[];
};

type ElChunk = {
  audio_base64?: string;
  alignment?: ElAlignment;
  normalized_alignment?: ElAlignment;
};

function emitChunk(res: ServerResponse, chunk: ElChunk, pcm: boolean): void {
  if (chunk.audio_base64) {
    writeNdjson(res, pcm ? { type: "audio", pcm: chunk.audio_base64, sampleRate: 24000 } : { type: "audio", mp3: chunk.audio_base64 });
  }
  const align = chunk.alignment ?? chunk.normalized_alignment;
  if (align?.chars?.length && align.charStartTimesMs?.length) {
    writeNdjson(res, {
      type: "alignment",
      chars: align.chars,
      charStartTimesMs: align.charStartTimesMs,
      charDurationsMs: align.charDurationsMs,
    });
  }
}

async function elevenLabsTimestampStream(text: string, outputFormat: "pcm_24000" | "mp3_44100_128"): Promise<Response | null> {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) return null;
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || "21m00Tcm4TlvDq8ikWAM";
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_turbo_v2_5";
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream/with-timestamps?output_format=${outputFormat}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "xi-api-key": key,
      },
      body: JSON.stringify({
        text: text.slice(0, 2500),
        model_id: modelId,
        voice_settings: HERA_VOICE_SETTINGS,
      }),
    },
  );
  if (!res.ok) return null;
  return res;
}

function extractJsonObjects(carry: { text: string }): ElChunk[] {
  const out: ElChunk[] = [];
  let src = carry.text;
  while (src.length) {
    const start = src.indexOf("{");
    if (start < 0) {
      carry.text = "";
      return out;
    }
    src = src.slice(start);
    let depth = 0;
    let inStr = false;
    let escape = false;
    let end = -1;
    for (let i = 0; i < src.length; i += 1) {
      const ch = src[i];
      if (inStr) {
        if (escape) escape = false;
        else if (ch === "\\") escape = true;
        else if (ch === "\"") inStr = false;
        continue;
      }
      if (ch === "\"") inStr = true;
      else if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) {
      carry.text = src;
      return out;
    }
    try {
      out.push(JSON.parse(src.slice(0, end + 1)) as ElChunk);
    } catch {
      /* skip */
    }
    src = src.slice(end + 1);
  }
  carry.text = src;
  return out;
}

export async function handleHeraVoiceStream(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const body = await readBody(req);
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      sendJson(res, 400, { error: "text required" });
      return;
    }

    const pcm = await elevenLabsTimestampStream(text, "pcm_24000");
    const upstream = pcm ?? (await elevenLabsTimestampStream(text, "mp3_44100_128"));
    if (!upstream?.body) {
      sendJson(res, 501, { error: "Streaming TTS not configured", hint: "Set ELEVENLABS_API_KEY" });
      return;
    }

    const isPcm = Boolean(pcm);
    res.writeHead(200, {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    });

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    const carry = { text: "" };
    while (true) {
      const { done, value } = await reader.read();
      carry.text += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      for (const chunk of extractJsonObjects(carry)) emitChunk(res, chunk, isPcm);
      if (done) break;
    }
    writeNdjson(res, { type: "done", text });
    res.end();
  } catch (err) {
    console.error("[hera/voice-stream]", err);
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Voice stream failed" });
      return;
    }
    writeNdjson(res, { type: "error", error: "Voice stream failed" });
    res.end();
  }
}

export function configureHeraVoiceStreamApi(
  server: ViteDevServer,
  env?: Record<string, string | undefined>,
): void {
  if (env) {
    for (const key of ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID", "ELEVENLABS_MODEL_ID"]) {
      const value = env[key];
      if (value && !process.env[key]) process.env[key] = value;
    }
  }
  server.middlewares.use("/api/hera/voice-stream", async (req, res, next) => {
    const method = (req as IncomingMessage).method;
    if (method !== "POST" && method !== "OPTIONS") {
      next();
      return;
    }
    await handleHeraVoiceStream(req as IncomingMessage, res as ServerResponse);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleHeraVoiceStream(req, res);
}
