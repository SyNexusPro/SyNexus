/** Public Paddle.js config (VITE_* only). Never put API keys or webhook secrets here. */

import type { Environments } from "@paddle/paddle-js";

function trim(value: string | undefined): string {
  return (value ?? "").trim();
}

/**
 * Fail loudly if the environment var is unset — never silently default to sandbox or live.
 */
export function requirePaddleEnvironment(): Environments {
  const raw = trim(import.meta.env.VITE_PADDLE_ENVIRONMENT as string | undefined).toLowerCase();
  if (raw === "sandbox" || raw === "production") return raw;
  throw new Error(
    'VITE_PADDLE_ENVIRONMENT must be set to "sandbox" or "production" (never inferred).',
  );
}

export function requirePaddleClientToken(): string {
  const token = trim(import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined);
  if (!token) {
    throw new Error("VITE_PADDLE_CLIENT_TOKEN is not set.");
  }
  const environment = requirePaddleEnvironment();
  if (environment === "production" && !token.startsWith("live_")) {
    throw new Error('Live Paddle requires a client token prefixed with "live_".');
  }
  if (environment === "sandbox" && !token.startsWith("test_") && !token.includes("_sdbx_")) {
    throw new Error("Sandbox Paddle expects a sandbox/test client token.");
  }
  return token;
}

export type PaddlePublicConfig = {
  clientToken: string;
  environment: Environments;
};

export function readPaddlePublicConfig(): PaddlePublicConfig | null {
  try {
    return {
      clientToken: requirePaddleClientToken(),
      environment: requirePaddleEnvironment(),
    };
  } catch {
    return null;
  }
}

export function isPaddleCheckoutConfigured(): boolean {
  return readPaddlePublicConfig() !== null;
}

/** @deprecated Prefer requirePaddleEnvironment + requirePaddleClientToken. */
export function isPaddleLiveCheckoutEnabled(): boolean {
  try {
    const environment = requirePaddleEnvironment();
    if (environment === "sandbox") return true;
    const flag = trim(import.meta.env.VITE_PADDLE_LIVE_CHECKOUT as string | undefined).toLowerCase();
    // Live overlay is allowed when explicitly enabled OR when a live_ token is present
    // after the operator has set VITE_PADDLE_ENVIRONMENT=production.
    if (flag === "false" || flag === "0" || flag === "no") return false;
    return Boolean(requirePaddleClientToken());
  } catch {
    return false;
  }
}
