/** Production refuses an open cron. Local and preview stay usable until a secret is set. */
export function openWhenSecretMissing(env: { VERCEL_ENV?: string }): boolean {
  return env.VERCEL_ENV !== "production";
}
