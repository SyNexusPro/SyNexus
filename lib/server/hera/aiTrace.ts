/**
 * Records why Hera answered, what failed, and what the call cost.
 * Sent to Langfuse only when LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are set.
 * Keys are never written into the trace.
 */
import crypto from "node:crypto";

export type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
};

/** Published list prices in USD per 1,000,000 tokens. Unknown models stay unpriced. */
const USD_PER_MILLION: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "text-embedding-3-small": { input: 0.02, output: 0 },
  "claude-3-5-haiku-latest": { input: 0.8, output: 4 },
  "claude-haiku-5-5": { input: 1, output: 5 },
};

export type HeraTrace = {
  at: string;
  name: string;
  model?: string;
  decision?: string;
  why?: string;
  input?: unknown;
  output?: unknown;
  usage?: TokenUsage;
  costUsdEstimate?: number;
  error?: string;
};

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

export function estimateCostUsd(model: string, usage: TokenUsage): number | undefined {
  const rate = USD_PER_MILLION[model];
  if (!rate) return undefined;
  const input = usage.inputTokens ?? 0;
  const output = usage.outputTokens ?? 0;
  if (!(input > 0) && !(output > 0)) return undefined;
  return Number((((input * rate.input) + (output * rate.output)) / 1_000_000).toFixed(8));
}

function redactString(value: string): string {
  return value
    .replace(/(api[_-]?key|secret|authorization|bearer|password|private[_-]?key|seed|mnemonic)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .slice(0, 2000);
}

export function redactTraceValue(value: unknown): unknown {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.slice(0, 20).map(redactTraceValue);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
    if (/(api[_-]?key|secret|authorization|password|private[_-]?key|seed|mnemonic|token)/i.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    out[key] = redactTraceValue(inner);
  }
  return out;
}

export function buildHeraTrace(input: Omit<HeraTrace, "at" | "costUsdEstimate"> & { at?: string }): HeraTrace {
  const usage = input.usage;
  const model = input.model;
  return {
    at: input.at ?? new Date().toISOString(),
    name: input.name,
    model,
    decision: input.decision,
    why: input.why ? redactString(input.why) : undefined,
    input: redactTraceValue(input.input),
    output: redactTraceValue(input.output),
    usage,
    costUsdEstimate: model && usage ? estimateCostUsd(model, usage) : undefined,
    error: input.error ? redactString(input.error) : undefined,
  };
}

export async function sendHeraTrace(
  env: Record<string, string | undefined>,
  trace: HeraTrace,
  fetchImpl: FetchImpl = fetch,
): Promise<"sent" | "skipped"> {
  const publicKey = env.LANGFUSE_PUBLIC_KEY?.trim();
  const secretKey = env.LANGFUSE_SECRET_KEY?.trim();
  if (!publicKey || !secretKey) return "skipped";
  const host = (env.LANGFUSE_HOST?.trim() || "https://cloud.langfuse.com").replace(/\/$/, "");
  const id = crypto.randomUUID();
  const batch = [
    {
      id: `${id}-trace`,
      type: "trace-create",
      timestamp: trace.at,
      body: {
        id,
        timestamp: trace.at,
        name: trace.name,
        input: trace.input ?? null,
        output: trace.output ?? trace.why ?? trace.error ?? null,
        metadata: {
          decision: trace.decision ?? "",
          why: trace.why ?? "",
          costUsdEstimate: trace.costUsdEstimate ?? null,
          error: trace.error ?? "",
        },
      },
    },
    {
      id: `${id}-gen`,
      type: "generation-create",
      timestamp: trace.at,
      body: {
        id: `${id}-generation`,
        traceId: id,
        name: trace.name,
        startTime: trace.at,
        endTime: trace.at,
        model: trace.model ?? "unknown",
        input: trace.input ?? null,
        output: trace.output ?? null,
        usage: {
          input: trace.usage?.inputTokens ?? 0,
          output: trace.usage?.outputTokens ?? 0,
          total: (trace.usage?.inputTokens ?? 0) + (trace.usage?.outputTokens ?? 0),
          unit: "TOKENS",
        },
        metadata: { costUsdEstimate: trace.costUsdEstimate ?? null, error: trace.error ?? "" },
      },
    },
  ];
  const token = Buffer.from(`${publicKey}:${secretKey}`).toString("base64");
  const response = await fetchImpl(`${host}/api/public/ingestion`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Basic ${token}` },
    body: JSON.stringify({ batch }),
    signal: AbortSignal.timeout(2_000),
  });
  if (!response.ok) throw new Error(`langfuse_${response.status}`);
  return "sent";
}

/** Never throws. A missed trace must not block the answer. */
export async function traceHera(
  env: Record<string, string | undefined>,
  input: Omit<HeraTrace, "at" | "costUsdEstimate">,
  fetchImpl?: FetchImpl,
): Promise<HeraTrace> {
  const trace = buildHeraTrace(input);
  try {
    await sendHeraTrace(env, trace, fetchImpl);
  } catch {
    /* Langfuse being down does not change the answer */
  }
  return trace;
}
