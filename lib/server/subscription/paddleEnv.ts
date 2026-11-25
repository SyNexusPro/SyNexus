/** Server-side Paddle credentials. Never expose PADDLE_API_KEY or PADDLE_WEBHOOK_SECRET to the browser. */

export type PaddleEnvironment = "sandbox" | "production";

export type PaddleServerEnv = {
  environment: PaddleEnvironment;
  apiKey: string;
  webhookSecret: string;
};

function trim(value: string | undefined): string {
  return (value ?? "").trim();
}

export function readPaddleEnvironment(env: Record<string, string | undefined> = process.env): PaddleEnvironment {
  const raw = trim(env.PADDLE_ENVIRONMENT).toLowerCase();
  return raw === "sandbox" ? "sandbox" : "production";
}

export function readPaddleServerEnv(env: Record<string, string | undefined> = process.env): PaddleServerEnv | null {
  const apiKey = trim(env.PADDLE_API_KEY);
  const webhookSecret = trim(env.PADDLE_WEBHOOK_SECRET);
  if (!apiKey || !webhookSecret) return null;
  return {
    environment: readPaddleEnvironment(env),
    apiKey,
    webhookSecret,
  };
}

export function isPaddleServerConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return readPaddleServerEnv(env) !== null;
}

/** Live checkout requires an explicit approval flag (sandbox may proceed without it). */
export function isPaddleLiveCheckoutEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (readPaddleEnvironment(env) === "sandbox") return true;
  const flag = trim(env.VITE_PADDLE_LIVE_CHECKOUT || env.PADDLE_LIVE_CHECKOUT).toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}

export function paddleApiBaseUrl(environment: PaddleEnvironment): string {
  return environment === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";
}
