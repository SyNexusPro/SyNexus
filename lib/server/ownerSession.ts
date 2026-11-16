import { createClient } from "@supabase/supabase-js";

export type OwnerEnv = Record<string, string | undefined>;

export type OwnerCheck =
  | { ok: true; email: string; userId: string }
  | { ok: false; status: 401 | 503; error: string };

export function configuredOwnerEmail(env: OwnerEnv): string | null {
  const email = env.SYNEXUS_OWNER_EMAIL?.trim().toLowerCase() ?? "";
  return email || null;
}

export function emailsMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = left?.trim().toLowerCase() ?? "";
  const b = right?.trim().toLowerCase() ?? "";
  return Boolean(a && b && a === b);
}

function supabaseAnon(env: OwnerEnv): { url: string; key: string } | null {
  const url = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").trim();
  const key = (env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "").trim();
  if (!url || !key) return null;
  return { url, key };
}

function client(env: OwnerEnv) {
  const creds = supabaseAnon(env);
  if (!creds) return null;
  return createClient(creds.url, creds.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Confirm a Supabase access token belongs to the configured owner email. */
export async function ownerFromAccessToken(token: string, env: OwnerEnv): Promise<OwnerCheck> {
  const expected = configuredOwnerEmail(env);
  const supabase = client(env);
  if (!expected || !supabase) {
    return { ok: false, status: 503, error: "Owner access is not configured on this server." };
  }
  const trimmed = token.trim();
  if (!trimmed) return { ok: false, status: 401, error: "Sign in with the owner account." };

  try {
    const { data, error } = await supabase.auth.getUser(trimmed);
    const email = data.user?.email ?? null;
    if (error || !data.user || !emailsMatch(email, expected)) {
      return { ok: false, status: 401, error: "This account is not the SyNexus owner." };
    }
    return { ok: true, email: email!.trim().toLowerCase(), userId: data.user.id };
  } catch {
    return { ok: false, status: 401, error: "Owner session could not be verified." };
  }
}

/**
 * Sign in through Supabase only after the email matches the owner allowlist.
 * The env password is not the login secret.
 */
export async function ownerFromPassword(email: string, password: string, env: OwnerEnv): Promise<OwnerCheck> {
  const expected = configuredOwnerEmail(env);
  const supabase = client(env);
  if (!expected || !supabase) {
    return { ok: false, status: 503, error: "Owner access is not configured on this server." };
  }
  if (!emailsMatch(email, expected) || !password) {
    return { ok: false, status: 401, error: "Wrong owner email or password." };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: expected,
      password,
    });
    const signedIn = data.user?.email ?? null;
    if (error || !data.session || !data.user || !emailsMatch(signedIn, expected)) {
      return { ok: false, status: 401, error: "Wrong owner email or password." };
    }
    return { ok: true, email: expected, userId: data.user.id };
  } catch {
    return { ok: false, status: 401, error: "Owner session could not be verified." };
  }
}
