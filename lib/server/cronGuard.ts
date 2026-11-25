/** Production refuses an open cron. Local and preview stay usable until a secret is set. */
export function openWhenSecretMissing(env: { VERCEL_ENV?: string }): boolean {
  return env.VERCEL_ENV !== "production";
}

/** Shared cron auth: Bearer / x-cron-secret, fail closed in production when unset. */
export function authorizeCronRequest(
  req: { headers: Record<string, string | string[] | undefined> },
  env: { VERCEL_ENV?: string; CRON_SECRET?: string; TITAN_EVENT_SECRET?: string },
  options: { allowTitanEventSecret?: boolean } = {},
): boolean {
  const secret =
    env.CRON_SECRET?.trim() ||
    (options.allowTitanEventSecret ? env.TITAN_EVENT_SECRET?.trim() : "") ||
    "";
  if (!secret) return openWhenSecretMissing(env);
  const auth = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  const header = typeof req.headers["x-cron-secret"] === "string" ? req.headers["x-cron-secret"] : "";
  return auth === `Bearer ${secret}` || auth.includes(secret) || header === secret;
}
