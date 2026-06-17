import { recordTrustedPlanGrant } from "./securityBot";
import { notifySynexusPlanChanged } from "../hooks/useSynexusPlan";
import { PLAN_STORAGE_KEY } from "./tradingFees";

export const OWNER_GRANT_KEY = "synexus_owner_grant";

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

/** Sign in with owner command ID + key (validated server-side). */
export async function unlockOwnerAccess(
  email: string,
  password: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch("/api/owner-unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      grant?: string;
      expiresAt?: number;
      error?: string;
    };

    if (!response.ok || !data.ok || !data.grant || !data.expiresAt) {
      return { ok: false, message: data.error ?? "Invalid command ID or key." };
    }

    writeStoredGrant({ grant: data.grant, expiresAt: data.expiresAt });
    applyOwnerProAccess();
    return { ok: true, message: "Command code accepted — full Synexus access unlocked." };
  } catch {
    return { ok: false, message: "Could not reach owner unlock service." };
  }
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
    const response = await fetch("/api/owner-unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant: stored.grant }),
    });
    const data = (await response.json().catch(() => ({}))) as { ok?: boolean };
    if (!response.ok || !data.ok) {
      clearOwnerAccess();
      return false;
    }
    applyOwnerProAccess();
    return true;
  } catch {
    /* offline — trust local grant until expiry if still valid */
    if (stored.expiresAt > Date.now()) {
      applyOwnerProAccess();
      return true;
    }
    return false;
  }
}
