import { recordTrustedPlanGrant } from "./securityBot";
import { notifySynexusPlanChanged } from "../hooks/useSynexusPlan";
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

async function postOwnerUnlock(body: Record<string, unknown>) {
  let lastError = "Could not reach owner unlock service.";
  for (const path of UNLOCK_PATHS) {
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

/** Sign in with owner command ID + key (validated server-side). */
export async function unlockOwnerAccess(
  email: string,
  password: string,
): Promise<{ ok: boolean; message: string }> {
  const { response, data } = await postOwnerUnlock({ email: email.trim(), password });
  if (!response) {
    return { ok: false, message: data.error ?? "Could not reach owner unlock service." };
  }
  if (response.status === 503) {
    return { ok: false, message: data.error ?? "God mode is not configured on this server." };
  }
  if (!response.ok || !data.ok || !data.grant || !data.expiresAt) {
    return { ok: false, message: data.error ?? "Invalid god mode ID or key." };
  }
  writeStoredGrant({ grant: data.grant, expiresAt: data.expiresAt });
  applyOwnerProAccess();
  return { ok: true, message: "God mode active — full SyNexus access unlocked." };
}

/** Re-validate stored grant on app load (keeps Pro after refresh). */
export async function refreshOwnerAccess(): Promise<boolean> {
  const stored = readStoredGrant();
  if (!stored?.grant) return false;
  if (stored.expiresAt <= Date.now()) {
    clearOwnerAccess();
    return false;
  }

  try {
    const { response, data } = await postOwnerUnlock({ grant: stored.grant });
    if (!response?.ok || !data.ok) {
      clearOwnerAccess();
      return false;
    }
    applyOwnerProAccess();
    return true;
  } catch {
    if (stored.expiresAt > Date.now()) {
      applyOwnerProAccess();
      return true;
    }
    return false;
  }
}
