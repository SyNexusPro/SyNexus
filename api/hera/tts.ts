/**
 * Server TTS for Hera hologram lip-sync (returns audio bytes).
 * Uses ELEVENLABS_API_KEY or OPENAI_API_KEY from env — never exposed to the client.
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

async function elevenLabsTts(text: string): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) return null;
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || "EXAVITQu4vr4xnSDxMaL";
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
      "xi-api-key": key,
    },
    body: JSON.stringify({
      text: text.slice(0, 2500),
      model_id: process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_turbo_v2_5",
      voice_settings: {
        stability: 0.52,
        similarity_boost: 0.72,
        style: 0.18,
        use_speaker_boost: true,
      },
    }),
  });
  if (!res.ok) return null;
  return { buffer: await res.arrayBuffer(), contentType: "audio/mpeg" };
}

const HERA_TTS_INSTRUCTIONS =
  "Speak as Hera, an original calm, intelligent, feminine AI. Confident, warm, slightly synthetic and futuristic. " +
  "Emotionally responsive, never theatrical. Do not imitate any copyrighted character, game AI, or voice actor. " +
  "Clear conversational American English. Natural pace.";

async function openAiTts(text: string): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts",
      voice: process.env.OPENAI_TTS_VOICE?.trim() || "nova",
      instructions: process.env.OPENAI_TTS_INSTRUCTIONS?.trim() || HERA_TTS_INSTRUCTIONS,
      input: text.slice(0, 2500),
      response_format: "mp3",
    }),
  });
  if (!res.ok) return null;
  return { buffer: await res.arrayBuffer(), contentType: "audio/mpeg" };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  try {
    const body = await readBody(req);
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "text required" }));
    }

    const audio = (await elevenLabsTts(text)) ?? (await openAiTts(text));
    if (!audio) {
      res.writeHead(501, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          error: "Remote TTS not configured",
          hint: "Set ELEVENLABS_API_KEY or OPENAI_API_KEY",
        }),
      );
    }

    res.writeHead(200, {
      "Content-Type": audio.contentType,
      "Cache-Control": "no-store",
    });
    return res.end(Buffer.from(audio.buffer));
  } catch (err) {
    console.error("[hera/tts]", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "TTS failed" }));
  }
}

export function configureHeraTtsApi(
  server: ViteDevServer,
  env?: Record<string, string | undefined>,
): void {
  if (env) {
        for (const key of ["OPENAI_API_KEY", "OPENAI_TTS_MODEL", "OPENAI_TTS_VOICE", "OPENAI_TTS_INSTRUCTIONS", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID", "ELEVENLABS_MODEL_ID"]) {
      const value = env[key];
      if (value && !process.env[key]) process.env[key] = value;
    }
  }
  server.middlewares.use("/api/hera/tts", async (req, res, next) => {
    const method = (req as IncomingMessage).method;
    if (method !== "POST" && method !== "OPTIONS") {
      next();
      return;
    }
    await handler(req as IncomingMessage, res as ServerResponse);
  });
}
