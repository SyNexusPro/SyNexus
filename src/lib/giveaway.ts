import { buildGiveawayReferralLink, buildGiveawayShareText, GIVEAWAY_REF_STORAGE_KEY } from "../config/giveaway";
import { supabase } from "./supabaseClient";

export type GiveawayStatus = {
  ok: boolean;
  authenticated: boolean;
  active: boolean;
  startsAt?: string;
  endsAt?: string;
  emailVerified?: boolean;
  profileComplete?: boolean;
  eligible?: boolean;
  totalEntries?: number;
  referralCount?: number;
  referralCode?: string;
  socialClaimed?: boolean;
  entries?: Array<{
    type: string;
    count: number;
    day?: string | null;
    createdAt?: string;
  }>;
  reason?: string;
};

function emptyStatus(): GiveawayStatus {
  return { ok: false, authenticated: false, active: false };
}

export function captureGiveawayReferralFromUrl(search: string): string | null {
  if (typeof window === "undefined") return null;
  const ref = new URLSearchParams(search).get("ref")?.trim();
  if (!ref || ref.length < 3) return null;
  try {
    localStorage.setItem(GIVEAWAY_REF_STORAGE_KEY, ref.toLowerCase());
  } catch {
    /* ignore */
  }
  return ref;
}

export function readStoredGiveawayReferral(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(GIVEAWAY_REF_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearStoredGiveawayReferral(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(GIVEAWAY_REF_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export async function fetchGiveawayStatus(): Promise<GiveawayStatus> {
  if (!supabase) return emptyStatus();
  try {
    const { data, error } = await supabase.rpc("giveaway_get_status");
    if (error) {
      if (error.message.toLowerCase().includes("does not exist")) {
        return { ok: false, authenticated: false, active: false, reason: "schema_missing" };
      }
      return emptyStatus();
    }
    return (data as GiveawayStatus) ?? emptyStatus();
  } catch {
    return emptyStatus();
  }
}

export async function syncGiveawayEntries(): Promise<GiveawayStatus> {
  if (!supabase) return emptyStatus();
  try {
    const ref = readStoredGiveawayReferral();
    if (ref) {
      await supabase.rpc("giveaway_apply_referral", { p_ref_code: ref });
    }
    const { data, error } = await supabase.rpc("giveaway_sync_entries");
    if (error) return emptyStatus();
    if (ref) clearStoredGiveawayReferral();
    return (data as GiveawayStatus) ?? emptyStatus();
  } catch {
    return emptyStatus();
  }
}

export async function claimGiveawaySocialBonus(): Promise<GiveawayStatus> {
  if (!supabase) return emptyStatus();
  try {
    const { data, error } = await supabase.rpc("giveaway_claim_social");
    if (error) return emptyStatus();
    return (data as GiveawayStatus) ?? emptyStatus();
  } catch {
    return emptyStatus();
  }
}

export async function saveGiveawayProfile(
  displayName: string,
  username: string,
  bio: string,
): Promise<GiveawayStatus & { saveError?: string }> {
  if (!supabase) return { ...emptyStatus(), saveError: "offline" };
  try {
    const { data, error } = await supabase.rpc("giveaway_save_profile", {
      p_display_name: displayName,
      p_username: username,
      p_bio: bio,
    });
    if (error) return { ...emptyStatus(), saveError: error.message };
    const status = (data as GiveawayStatus & { reason?: string }) ?? emptyStatus();
    if (status.reason) {
      return { ...status, saveError: status.reason };
    }
    return status;
  } catch {
    return { ...emptyStatus(), saveError: "unknown" };
  }
}

export async function shareGiveaway(referralCode: string): Promise<"shared" | "copied" | "failed"> {
  const link = buildGiveawayReferralLink(referralCode);
  const text = buildGiveawayShareText(link);
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: "Synexus Launch Giveaway", text, url: link });
      return "shared";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return "failed";
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
