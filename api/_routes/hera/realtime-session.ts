/**
 * Hera voice session: GPT-Live-1 WebRTC (SDP exchanged on the server) with
 * Realtime fallback. OPENAI_API_KEY never leaves the server.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "../viteDevServer";

import { HERA_CONVERSATION_INSTRUCTIONS, HERA_VOICE_INSTRUCTIONS } from "../../../src/lib/hera/heraPrompt";
import { resolveTitanAuthPlan } from "../../../lib/server/titan/authPlan.js";

type Incoming = IncomingMessage & { body?: unknown };

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

function realtimeModelName(): string {
  return process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime-2.1";
}

function dedupe(values: (string | undefined)[]): string[] {
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed && !out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}

function realtimeModelCandidates(): string[] {
  return dedupe(["gpt-realtime-2.1", process.env.OPENAI_REALTIME_MODEL, "gpt-realtime"]);
}

function liveModelCandidates(): string[] {
  const env = process.env.OPENAI_LIVE_MODEL?.trim() || process.env.OPENAI_REALTIME_MODEL?.trim();
  const preferred = env && env.toLowerCase().includes("live") ? env : "gpt-live-1";
  return dedupe([preferred, "gpt-live-1"]);
}

function voiceName(): string {
  const raw = (process.env.OPENAI_REALTIME_VOICE?.trim() || "marin").toLowerCase();
  if (raw === "coral" || raw === "shimmer") return "marin";
  return raw;
}

function liveInstructions(): string {
  return `${HERA_CONVERSATION_INSTRUCTIONS}\n\nSpoken voice: ${HERA_VOICE_INSTRUCTIONS}`;
}

function realtimeSessionConfig(model = realtimeModelName()) {
  const voice = voiceName();
  return {
    type: "realtime" as const,
    model,
    instructions: HERA_CONVERSATION_INSTRUCTIONS,
    output_modalities: ["audio"] as const,
    temperature: 0.85,
    audio: {
      input: {
        transcription: { model: "gpt-4o-mini-transcribe" },
        turn_detection: {
          type: "semantic_vad",
          eagerness: "medium",
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

function extractTransportSdp(json: Record<string, unknown>): string {
  const transport = json.transport;
  if (transport && typeof transport === "object" && typeof (transport as { sdp?: string }).sdp === "string") {
    return (transport as { sdp: string }).sdp.trim();
  }
  if (typeof json.sdp === "string") return json.sdp.trim();
  return "";
}

function extractSessionId(json: Record<string, unknown>): string {
  const session = json.session;
  if (session && typeof session === "object" && typeof (session as { id?: string }).id === "string") {
    return (session as { id: string }).id.trim();
  }
  if (typeof json.id === "string") return json.id.trim();
  return "";
}

async function readJsonBody(req: Incoming): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === "string" && req.body.trim()) {
    return JSON.parse(req.body) as Record<string, unknown>;
  }
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve());
    req.on("error", reject);
  });
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

async function createLiveSession(
  key: string,
  sdp: string,
): Promise<{ sdp: string; sessionId: string; model: string } | null> {
  const voice = voiceName();
  for (const model of liveModelCandidates()) {
    const upstream = await fetch("https://api.openai.com/v1/live/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": "synexus-hera-web",
      },
      body: JSON.stringify({
        session: {
          model,
          instructions: liveInstructions(),
          audio: { output: { voice } },
        },
        transport: { type: "webrtc", sdp },
      }),
    });
    const json = (await upstream.json()) as Record<string, unknown>;
    if (!upstream.ok) {
      console.error("[hera/realtime-session] live sessions failed", model, upstream.status, json);
      continue;
    }
    const answer = extractTransportSdp(json);
    if (answer) {
      return { sdp: answer, sessionId: extractSessionId(json), model };
    }
    console.error("[hera/realtime-session] live sessions missing SDP", model, json);
  }
  return null;
}

async function createRealtimeCall(key: string, sdp: string): Promise<{ sdp: string; model: string } | null> {
  for (const model of realtimeModelCandidates()) {
    const fd = new FormData();
    fd.set("sdp", sdp);
    fd.set("session", JSON.stringify(realtimeSessionConfig(model)));
    const upstream = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "OpenAI-Safety-Identifier": "synexus-hera-web",
      },
      body: fd,
    });
    const body = await upstream.text();
    if (!upstream.ok) {
      console.error("[hera/realtime-session] realtime/calls failed", model, upstream.status, body.slice(0, 240));
      continue;
    }
    const answer = body.trim();
    if (answer.startsWith("v=") || answer.includes("m=audio")) {
      return { sdp: answer, model };
    }
    try {
      const json = JSON.parse(body) as Record<string, unknown>;
      const nested = extractTransportSdp(json);
      if (nested) return { sdp: nested, model };
    } catch {
      /* not JSON */
    }
  }
  return null;
}

async function mintGaSecret(key: string): Promise<{ secret: string; raw: Record<string, unknown> } | null> {
  const models = realtimeModelCandidates();
  for (const model of models) {
    const upstream = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": "synexus-hera-web",
      },
      body: JSON.stringify({ session: realtimeSessionConfig(model) }),
    });
    const json = (await upstream.json()) as Record<string, unknown>;
    if (!upstream.ok) {
      console.error("[hera/realtime-session] client_secrets failed", model, upstream.status, json);
      continue;
    }
    const secret = extractSecret(json);
    if (secret) return { secret, raw: { ...json, model } };
  }
  return null;
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
      temperature: 0.85,
      input_audio_transcription: { model: "gpt-4o-mini-transcribe" },
      turn_detection: {
        type: "semantic_vad",
        eagerness: "medium",
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
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

  const authHeader = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  if (authHeader) {
    const auth = await resolveTitanAuthPlan(req, sessionEnv);
    if (!auth.authenticated) {
      sendJson(res, 401, { error: "invalid_session" });
      return;
    }
  }

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await readJsonBody(req);
    } catch {
      body = {};
    }
    const sdp = typeof body.sdp === "string" ? body.sdp.trim() : "";

    if (sdp) {
      const live = await createLiveSession(key, sdp);
      if (live) {
        sendJson(res, 200, {
          mode: "live",
          model: live.model,
          voice: voiceName(),
          session: { id: live.sessionId },
          transport: { type: "webrtc", sdp: live.sdp },
        });
        return;
      }
      const realtime = await createRealtimeCall(key, sdp);
      if (realtime) {
        sendJson(res, 200, {
          mode: "realtime",
          model: realtime.model,
          voice: voiceName(),
          transport: { type: "webrtc", sdp: realtime.sdp },
        });
        return;
      }
      sendJson(res, 502, { error: "Voice session unavailable" });
      return;
    }

    const minted = (await mintGaSecret(key)) ?? (await mintLegacySecret(key));
    if (!minted) {
      sendJson(res, 502, { error: "Realtime session unavailable" });
      return;
    }
    sendJson(res, 200, {
      mode: "realtime",
      value: minted.secret,
      client_secret: { value: minted.secret },
      model:
        (typeof minted.raw.model === "string" && minted.raw.model.trim()) || realtimeModelName(),
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
    for (const key of [
      "OPENAI_API_KEY",
      "TITAN_API_KEY",
      "OPENAI_LIVE_MODEL",
      "OPENAI_REALTIME_MODEL",
      "OPENAI_REALTIME_VOICE",
    ]) {
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
