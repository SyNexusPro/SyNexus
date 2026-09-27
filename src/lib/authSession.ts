import { OWNER_GRANT_KEY } from "./ownerAccess";
import { supabase } from "./supabaseClient";

function storedOwnerGrant(): string | null {
  try {
    const raw = localStorage.getItem(OWNER_GRANT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { grant?: string; expiresAt?: number };
    return parsed.grant && (parsed.expiresAt ?? 0) > Date.now() ? parsed.grant : null;
  } catch {
    return null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function authHeaders(extra?: HeadersInit): Promise<HeadersInit> {
  const token = await getAccessToken();
  const ownerGrant = storedOwnerGrant();
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(ownerGrant ? { "X-Synexus-Owner-Grant": ownerGrant } : {}),
  };
}
