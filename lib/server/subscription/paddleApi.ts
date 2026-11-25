import { paddleApiBaseUrl, readPaddleEnvironment, type PaddleEnvironment } from "./paddleEnv.js";

type Env = Record<string, string | undefined>;

export type PaddlePortalSession = {
  id: string;
  customerId: string;
  urls: { general: { overview: string } };
};

function trim(value: string | undefined): string {
  return (value ?? "").trim();
}

export function readPaddleApiKey(env: Env = process.env): string | null {
  const key = trim(env.PADDLE_API_KEY);
  return key || null;
}

async function paddleFetch<T>(
  env: Env,
  path: string,
  init: RequestInit & { method?: string } = {},
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const apiKey = readPaddleApiKey(env);
  if (!apiKey) return { ok: false, status: 503, error: "Paddle API key is not configured." };

  const environment: PaddleEnvironment = readPaddleEnvironment(env);
  const url = `${paddleApiBaseUrl(environment)}${path}`;
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const json = (await response.json().catch(() => null)) as
      | { data?: T; error?: { detail?: string; documentation_url?: string } }
      | null;
    if (!response.ok) {
      return {
        ok: false,
        status: response.status >= 400 && response.status < 600 ? response.status : 502,
        error: json?.error?.detail || `Paddle API error (${response.status}).`,
      };
    }
    return { ok: true, data: (json?.data ?? json) as T };
  } catch (error) {
    console.error("[paddle/api]", error);
    return { ok: false, status: 502, error: "Paddle API is unreachable." };
  }
}

/** Mint a hosted customer portal session. API key never leaves the server. */
export async function createCustomerPortalSession(
  env: Env,
  customerId: string,
  subscriptionIds: string[] = [],
): Promise<{ ok: true; url: string; sessionId: string } | { ok: false; status: number; error: string }> {
  const id = trim(customerId);
  if (!id.startsWith("ctm_")) {
    return { ok: false, status: 400, error: "A Paddle customer id is required." };
  }

  const result = await paddleFetch<PaddlePortalSession>(env, `/customers/${id}/portal-sessions`, {
    method: "POST",
    body: JSON.stringify({
      subscription_ids: subscriptionIds.filter((value) => value.startsWith("sub_")),
    }),
  });

  if (!result.ok) return result;
  const overview = result.data?.urls?.general?.overview?.trim() ?? "";
  if (!overview) return { ok: false, status: 502, error: "Paddle did not return a portal URL." };
  return { ok: true, url: overview, sessionId: result.data.id };
}
