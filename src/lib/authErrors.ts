export const AUTH_USER_FRIENDLY_ERROR = "Something went wrong. Please try again.";

export function describeAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("invalid login credentials") || lower.includes("invalid_grant")) {
    return "Wrong email or password.";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirm your email before signing in.";
  }
  if (lower.includes("too many requests") || lower.includes("rate")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (lower.includes("user already registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (
    lower.includes("does not exist") ||
    lower.includes("schema cache") ||
    lower.includes("could not find the table") ||
    lower.includes("pgrst205") ||
    lower.includes("undefined_table") ||
    lower.includes("42p01")
  ) {
    return AUTH_USER_FRIENDLY_ERROR;
  }
  return AUTH_USER_FRIENDLY_ERROR;
}

function describeOAuthRedirectError(error: string | null, description: string | null): string {
  const combined = `${error ?? ""} ${description ?? ""}`.toLowerCase();
  if (combined.includes("access_denied") || combined.includes("cancelled") || combined.includes("canceled")) {
    return "Google sign-in was cancelled.";
  }
  if (description?.trim()) {
    return description.replace(/\+/g, " ").trim();
  }
  return "Google sign-in failed. Try email instead.";
}

/** Read and strip `error` / `error_description` from the current URL (query or hash). */
export function consumeAuthRedirectError(): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  const error = url.searchParams.get("error") ?? hashParams.get("error");
  const description = url.searchParams.get("error_description") ?? hashParams.get("error_description");
  if (!error && !description) return null;

  for (const key of ["error", "error_description", "error_code"]) {
    url.searchParams.delete(key);
    hashParams.delete(key);
  }
  const nextHash = hashParams.toString();
  url.hash = nextHash ? nextHash : "";
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  return describeOAuthRedirectError(error, description);
}
