/**
 * Mints an ephemeral OpenAI Realtime client secret for browser WebRTC.
 * OPENAI_API_KEY never leaves the server.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "../viteDevServer";

import { HERA_CONVERSATION_INSTRUCTIONS, HERA_VOICE_INSTRUCTIONS } from "../../src/lib/hera/heraPrompt";

let sessionEnv: Record<string, string | undefined> = process.env;

function openaiRealtimeKey(): string {
  const openai = sessionEnv.OPENAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
  if (openai) return openai;
  const titan = sessionEnv.TITAN_API_KEY?.trim() || process.env.TITAN_API_KEY?.trim() || "";
  if (titan.startsWith("sk-") || titan.startsWith("sk_")) return titan;
  return "";
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function modelName(): string {
  return process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime";
}

function voiceName(): string {
  return process.env.OPENAI_REALTIME_VOICE?.trim() || "coral";
}

function sessionConfig() {
  const model = modelName();
  const voice = voiceName();
  return {
    type: "realtime" as const,
    model,
    instructions: HERA_CONVERSATION_INSTRUCTIONS,
    temperature: 0.8,
    audio: {
      input: {
        transcription: { model: "gpt-4o-mini-transcribe" },
        turn_detection: {
          type: "semantic_vad",
          eagerness: "low",
          create_response: true,
          interrupt_response: true,
        },
      },
      output: { voice, instructions: HERA_VOICE_INSTRUCTIONS },
    },
  };
}

function extractSecret(json: Record<string, unknown>): string {
  if (typeof json.value === "string" && json.value.trim()) return json.value.trim();
  const secret = json.client_secret;
  if (typeof secret === "string" && secret.trim()) return secret.trim();
  if (secret && typeof secret === "object" && typeof (secret as { value?: string }).value === "string") {
    return (secret as { value: string }).value.trim();
  }
  return "";
}

async function mintGaSecret(key: string): Promise<{ secret: string; raw: Record<string, unknown> } | null> {
  const upstream = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": "synexus-hera-web",
    },
    body: JSON.stringify({ session: sessionConfig() }),
  });
  const json = (await upstream.json()) as Record<string, unknown>;
  if (!upstream.ok) {
    console.error("[hera/realtime-session] client_secrets failed", upstream.status, json);
    return null;
  }
  const secret = extractSecret(json);
  return secret ? { secret, raw: json } : null;
}

async function mintLegacySecret(key: string): Promise<{ secret: string; raw: Record<string, unknown> } | null> {
  const model = process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-4o-realtime-preview";
  const voice = voiceName();
  const upstream = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "realtime=v1",
      "OpenAI-Safety-Identifier": "synexus-hera-web",
    },
    body: JSON.stringify({
      model,
      modalities: ["audio", "text"],
      instructions: HERA_CONVERSATION_INSTRUCTIONS,
      voice,
      temperature: 0.8,
      input_audio_transcription: { model: "gpt-4o-mini-transcribe" },
      turn_detection: {
        type: "semantic_vad",
        eagerness: "low",
        create_response: true,
        interrupt_response: true,
      },
    }),
  });
  const json = (await upstream.json()) as Record<string, unknown>;
  if (!upstream.ok) {
    console.error("[hera/realtime-session] sessions failed", upstream.status, json);
    return null;
  }
  const secret = extractSecret(json);
  return secret ? { secret, raw: json } : null;
}

export async function handleHeraRealtimeSession(req: IncomingMessage, res: ServerResponse): Promise<void> {
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

  const key = openaiRealtimeKey();
  if (!key) {
    sendJson(res, 501, { error: "OPENAI_API_KEY not configured" });
    return;
  }

  try {
    const minted = (await mintGaSecret(key)) ?? (await mintLegacySecret(key));
    if (!minted) {
      sendJson(res, 502, { error: "Realtime session unavailable" });
      return;
    }
    sendJson(res, 200, {
      value: minted.secret,
      client_secret: { value: minted.secret },
      model: modelName(),
      voice: voiceName(),
      expires_at:
        (minted.raw.expires_at as number | undefined) ??
        (minted.raw.client_secret as { expires_at?: number } | undefined)?.expires_at,
    });
  } catch (err) {
    console.error("[hera/realtime-session]", err);
    sendJson(res, 502, { error: "Realtime session failed" });
  }
}

export function configureHeraRealtimeSessionApi(
  server: ViteDevServer,
  env?: Record<string, string | undefined>,
): void {
  if (env) sessionEnv = { ...process.env, ...env };
  if (env) {
    for (const key of ["OPENAI_API_KEY", "TITAN_API_KEY", "OPENAI_REALTIME_MODEL", "OPENAI_REALTIME_VOICE"]) {
      const value = env[key]?.trim();
      if (value) process.env[key] = value;
    }
  }
  const heraSession = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const method = req.method;
    if (method !== "POST" && method !== "OPTIONS") {
      next();
      return;
    }
    await handleHeraRealtimeSession(req, res);
  };
  server.middlewares.use("/api/hera/realtime-session", heraSession);
  server.middlewares.use("/api/hera/session", heraSession);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleHeraRealtimeSession(req, res);
}
