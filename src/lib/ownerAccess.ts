import { recordTrustedPlanGrant } from "./securityBot";
import { notifySynexusPlanChanged } from "../hooks/useSynexusPlan";
import { signInWithEmail } from "./supabaseData";
import { supabase } from "./supabaseClient";
import { PLAN_STORAGE_KEY } from "./tradingFees";

export const OWNER_GRANT_KEY = "synexus_owner_grant";
export const OWNER_ACCESS_CHANGED = "synexus-owner-access-changed";

type OwnerGrantRecord = {
  grant: string;
  expiresAt: number;
};

function readStoredGrant(): OwnerGrantRecord | null {
  try {
    const raw = localStorage.getItem(OWNER_GRANT_KEY);
    return raw ? (JSON.parse(raw) as OwnerGrantRecord) : null;
  } catch {
    return null;
  }
}

function writeStoredGrant(record: OwnerGrantRecord | null) {
  try {
    if (!record) localStorage.removeItem(OWNER_GRANT_KEY);
    else localStorage.setItem(OWNER_GRANT_KEY, JSON.stringify(record));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event(OWNER_ACCESS_CHANGED));
  } catch {
    /* ignore */
  }
}

/** Apply full Pro access after server validates owner credentials. */
export function applyOwnerProAccess() {
  recordTrustedPlanGrant("PRO", "owner");
  localStorage.setItem(PLAN_STORAGE_KEY, "PRO");
  notifySynexusPlanChanged();
}

export function clearOwnerAccess() {
  writeStoredGrant(null);
}

export function hasStoredOwnerGrant(): boolean {
  const stored = readStoredGrant();
  return Boolean(stored?.grant && stored.expiresAt > Date.now());
}

const UNLOCK_PATHS = ["/api/owner-unlock", "/api/ownerUnlock"];

async function currentAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function postOwnerUnlock(body: Record<string, unknown>, authorization?: string | null) {
  let lastError = "Could not reach owner unlock service.";
  for (const path of UNLOCK_PATHS) {
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authorization ? { Authorization: authorization } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8_000),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        grant?: string;
        expiresAt?: number;
        error?: string;
      };
      if (response.status === 404) {
        lastError = data.error ?? lastError;
        continue;
      }
      return { response, data };
    } catch {
      continue;
    }
  }
  return { response: null, data: { error: lastError } as { ok?: boolean; grant?: string; expiresAt?: number; error?: string } };
}

/** Sign the owner in with Supabase, then ask the server to confirm that account. */
export async function unlockOwnerAccess(
  email: string,
  password: string,
): Promise<{ ok: boolean; message: string }> {
  let token: string | null = null;
  try {
    const signedIn = await signInWithEmail(email, password);
    token = signedIn.session?.access_token ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign-in failed.";
    return { ok: false, message };
  }
  if (!token) {
    return {
      ok: false,
      message: "Supabase did not return a session. Confirm the owner user in the Supabase dashboard.",
    };
  }

  const { response, data } = await postOwnerUnlock({}, `Bearer ${token}`);
  if (!response) {
    return { ok: false, message: data.error ?? "Could not reach owner unlock service." };
  }
  if (response.status === 503) {
    return { ok: false, message: data.error ?? "Owner access is not configured on this server." };
  }
  if (!response.ok || !data.ok || !data.grant || !data.expiresAt) {
    return { ok: false, message: data.error ?? "This account is not the SyNexus owner." };
  }
  writeStoredGrant({ grant: data.grant, expiresAt: data.expiresAt });
  applyOwnerProAccess();
  return { ok: true, message: "Owner access unlocked. Full Pro on this device — no subscription." };
}

/** Re-validate stored grant on app load (keeps Pro after refresh). */
export async function refreshOwnerAccess(): Promise<boolean> {
  const stored = readStoredGrant();
  if (!stored?.grant) return false;
  if (stored.expiresAt <= Date.now()) {
    clearOwnerAccess();
    return false;
  }

  const token = await currentAccessToken();
  if (!token) {
    clearOwnerAccess();
    return false;
  }

  try {
    const { response, data } = await postOwnerUnlock({ grant: stored.grant }, `Bearer ${token}`);
    if (!response?.ok || !data.ok || !data.grant || !data.expiresAt) {
      clearOwnerAccess();
      return false;
    }
    writeStoredGrant({ grant: data.grant, expiresAt: data.expiresAt });
    applyOwnerProAccess();
    return true;
  } catch {
    clearOwnerAccess();
    return false;
  }
}
