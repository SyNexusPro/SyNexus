import { createHash, createHmac, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { IncomingMessage } from "node:http";

const INVITE_REQUIRED_COUNT = 3;
const INVITE_REWARD_DAYS = 30;
const INVITE_MIN_AGE = 18;

export type InviteEnv = Record<string, string | undefined>;

export type InviteStatus = {
  referralCode: string;
  inviteUrlPath: string;
  qualifiedCount: number;
  requiredCount: number;
  pendingCount: number;
  rewardClaimed: boolean;
  rewardActive: boolean;
  rewardUntil: string | null;
  identityVerified: boolean;
  cardVerified: boolean;
  referredBy: boolean;
  onboardComplete: boolean;
};

type ProfileRow = {
  id: string;
  referral_code: string | null;
  referred_by: string | null;
  identity_status: string | null;
  identity_fingerprint: string | null;
  card_verified: boolean | null;
  card_fingerprint: string | null;
  invite_reward_claimed: boolean | null;
  invite_reward_until: string | null;
  paid_plan?: string | null;
};

function adminClient(env: InviteEnv): SupabaseClient | null {
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!url?.trim() || !key?.trim()) return null;
  return createClient(url.trim(), key.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function anonClient(env: InviteEnv): SupabaseClient | null {
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  if (!url?.trim() || !key?.trim()) return null;
  return createClient(url.trim(), key.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function bearerFromRequest(req: IncomingMessage): string | null {
  const raw = req.headers.authorization;
  if (typeof raw !== "string") return null;
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export async function userFromBearer(req: IncomingMessage, env: InviteEnv): Promise<User | null> {
  const token = bearerFromRequest(req);
  if (!token) return null;
  const anon = anonClient(env);
  if (!anon) return null;
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

function pepper(env: InviteEnv): string {
  return (
    env.SYNEXUS_IDENTITY_PEPPER?.trim() ||
    env.SYNEXUS_OWNER_SIGNING_KEY?.trim() ||
    "synexus-identity-pepper"
  );
}

export function identityFingerprint(
  env: InviteEnv,
  input: {
    legalName: string;
    dob: string;
    country: string;
    idType: string;
    idLast4: string;
  },
): string {
  const name = input.legalName.toLowerCase().replace(/\s+/g, " ").trim();
  const payload = [
    input.country.trim().toUpperCase(),
    input.idType.trim().toLowerCase(),
    input.idLast4.trim(),
    name,
    input.dob.trim(),
  ].join("|");
  return createHmac("sha256", pepper(env)).update(payload).digest("hex");
}

function makeReferralCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let out = "SN";
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

function ageFromDob(dob: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob.trim());
  if (!match) return null;
  const born = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const m = now.getUTCMonth() - born.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
  return age;
}

async function loadProfile(admin: SupabaseClient, userId: string): Promise<ProfileRow | null> {
  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, referral_code, referred_by, identity_status, identity_fingerprint, card_verified, card_fingerprint, invite_reward_claimed, invite_reward_until, paid_plan",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as ProfileRow | null) ?? null;
}

async function ensureProfile(admin: SupabaseClient, user: User): Promise<ProfileRow> {
  const existing = await loadProfile(admin, user.id);
  if (existing) {
    if (existing.referral_code) return existing;
    for (let i = 0; i < 6; i += 1) {
      const code = makeReferralCode();
      const { error } = await admin.from("profiles").update({ referral_code: code }).eq("id", user.id);
      if (!error) return { ...existing, referral_code: code };
    }
    throw new Error("Could not assign a referral code.");
  }

  const code = makeReferralCode();
  const email = user.email ?? "member";
  const local = email.split("@")[0] ?? "member";
  const { error } = await admin.from("profiles").insert({
    id: user.id,
    username: `${local.replace(/[^a-z0-9_]/gi, "_").slice(0, 18)}_${user.id.replace(/-/g, "").slice(0, 6)}`.toLowerCase(),
    display_name: local,
    referral_code: code,
  });
  if (error) throw error;
  const created = await loadProfile(admin, user.id);
  if (!created) throw new Error("Profile missing after insert.");
  return created;
}

function rewardActive(until: string | null, now = Date.now()): boolean {
  if (!until) return false;
  const ms = Date.parse(until);
  return Number.isFinite(ms) && ms > now;
}

async function counts(admin: SupabaseClient, referrerId: string) {
  const { data, error } = await admin
    .from("referrals")
    .select("status")
    .eq("referrer_id", referrerId);
  if (error) throw error;
  const rows = data ?? [];
  return {
    qualifiedCount: rows.filter((r) => r.status === "qualified").length,
    pendingCount: rows.filter((r) => r.status === "pending").length,
  };
}

async function maybeGrantReward(admin: SupabaseClient, referrerId: string): Promise<void> {
  const profile = await loadProfile(admin, referrerId);
  if (!profile) return;
  if (profile.invite_reward_claimed) return;
  if (profile.identity_status !== "verified" || !profile.card_verified) return;

  const { qualifiedCount } = await counts(admin, referrerId);
  if (qualifiedCount < INVITE_REQUIRED_COUNT) return;

  const until = new Date(Date.now() + INVITE_REWARD_DAYS * 86_400_000).toISOString();
  const { error } = await admin
    .from("profiles")
    .update({
      invite_reward_claimed: true,
      invite_reward_until: until,
      paid_plan: "PRO",
      subscription_status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", referrerId)
    .eq("invite_reward_claimed", false);
  if (error) {
    await admin
      .from("profiles")
      .update({
        invite_reward_claimed: true,
        invite_reward_until: until,
        paid_plan: "PRO",
        updated_at: new Date().toISOString(),
      })
      .eq("id", referrerId)
      .eq("invite_reward_claimed", false);
  }
}

export async function qualifyIfReady(admin: SupabaseClient, refereeId: string): Promise<void> {
  const profile = await loadProfile(admin, refereeId);
  if (!profile) return;
  if (profile.identity_status !== "verified" || !profile.card_verified) return;
  if (!profile.referred_by) return;

  await admin
    .from("referrals")
    .update({ status: "qualified", qualified_at: new Date().toISOString() })
    .eq("referee_id", refereeId)
    .eq("status", "pending");

  await maybeGrantReward(admin, profile.referred_by);
}

function toStatus(profile: ProfileRow, qualifiedCount: number, pendingCount: number): InviteStatus {
  const identityVerified = profile.identity_status === "verified";
  const cardVerified = Boolean(profile.card_verified);
  return {
    referralCode: profile.referral_code || "",
    inviteUrlPath: profile.referral_code ? `/invite/${profile.referral_code}` : "/invite",
    qualifiedCount,
    requiredCount: INVITE_REQUIRED_COUNT,
    pendingCount,
    rewardClaimed: Boolean(profile.invite_reward_claimed),
    rewardActive: rewardActive(profile.invite_reward_until),
    rewardUntil: profile.invite_reward_until,
    identityVerified,
    cardVerified,
    referredBy: Boolean(profile.referred_by),
    onboardComplete: identityVerified && cardVerified,
  };
}

export async function getInviteStatus(user: User, env: InviteEnv): Promise<InviteStatus> {
  const admin = adminClient(env);
  if (!admin) throw new Error("Invite service is not configured.");
  const profile = await ensureProfile(admin, user);
  const { qualifiedCount, pendingCount } = await counts(admin, user.id);
  return toStatus(profile, qualifiedCount, pendingCount);
}

export async function attachReferral(
  user: User,
  codeRaw: string,
  env: InviteEnv,
): Promise<{ ok: boolean; message: string }> {
  const admin = adminClient(env);
  if (!admin) throw new Error("Invite service is not configured.");
  const code = codeRaw.trim().toUpperCase();
  if (!/^SN[A-Z0-9]{6}$/.test(code)) {
    return { ok: false, message: "That invite code is not valid." };
  }

  const me = await ensureProfile(admin, user);
  if (me.referred_by) {
    return { ok: true, message: "This account is already linked to an invite." };
  }
  if (me.referral_code === code) {
    return { ok: false, message: "You cannot use your own invite link." };
  }

  const { data: referrer, error } = await admin
    .from("profiles")
    .select("id, referral_code")
    .eq("referral_code", code)
    .maybeSingle();
  if (error) throw error;
  if (!referrer?.id || referrer.id === user.id) {
    return { ok: false, message: "That invite code is not valid." };
  }

  const { error: refErr } = await admin.from("referrals").insert({
    referrer_id: referrer.id,
    referee_id: user.id,
    status: "pending",
  });
  if (refErr) {
    if (/duplicate|unique/i.test(refErr.message)) {
      return { ok: true, message: "This account is already linked to an invite." };
    }
    throw refErr;
  }

  await admin.from("profiles").update({ referred_by: referrer.id }).eq("id", user.id).is("referred_by", null);
  await qualifyIfReady(admin, user.id);
  return { ok: true, message: "Invite linked. Finish identity and card checks to count." };
}

export async function submitIdentity(
  user: User,
  body: {
    legalName?: string;
    dob?: string;
    country?: string;
    idType?: string;
    idLast4?: string;
    attestation?: boolean;
  },
  env: InviteEnv,
): Promise<{ ok: boolean; message: string }> {
  const admin = adminClient(env);
  if (!admin) throw new Error("Invite service is not configured.");

  const legalName = (body.legalName ?? "").replace(/\s+/g, " ").trim();
  const dob = (body.dob ?? "").trim();
  const country = (body.country ?? "").trim().toUpperCase();
  const idType = (body.idType ?? "").trim().toLowerCase();
  const idLast4 = (body.idLast4 ?? "").replace(/\D/g, "").slice(-4);
  const allowedId = new Set(["passport", "drivers_license", "national_id"]);

  if (!body.attestation) {
    return { ok: false, message: "Confirm you are the person named on the ID and card." };
  }
  if (legalName.length < 4 || !/^[\p{L}][\p{L} .'-]+[\p{L}]$/u.test(legalName)) {
    return { ok: false, message: "Enter your legal first and last name." };
  }
  const age = ageFromDob(dob);
  if (age == null) return { ok: false, message: "Enter your date of birth." };
  if (age < INVITE_MIN_AGE) return { ok: false, message: "You must be 18 or older." };
  if (!/^[A-Z]{2}$/.test(country)) return { ok: false, message: "Choose your country." };
  if (!allowedId.has(idType)) return { ok: false, message: "Choose a government ID type." };
  if (!/^\d{4}$/.test(idLast4)) return { ok: false, message: "Enter the last 4 digits of your ID number." };

  const fingerprint = identityFingerprint(env, { legalName, dob, country, idType, idLast4 });
  await ensureProfile(admin, user);

  const { data: dup } = await admin
    .from("profiles")
    .select("id")
    .eq("identity_fingerprint", fingerprint)
    .neq("id", user.id)
    .maybeSingle();
  if (dup?.id) {
    return {
      ok: false,
      message: "This identity is already used on another SyNexus account. One person, one account.",
    };
  }

  const { error } = await admin
    .from("profiles")
    .update({
      identity_status: "verified",
      identity_verified_at: new Date().toISOString(),
      identity_full_name: legalName,
      identity_country: country,
      identity_fingerprint: fingerprint,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) {
    if (/unique|duplicate/i.test(error.message)) {
      return { ok: false, message: "This identity is already used on another SyNexus account." };
    }
    throw error;
  }

  await qualifyIfReady(admin, user.id);
  return { ok: true, message: "Identity verified. Add a valid debit or credit card next." };
}

export async function markCardVerified(
  userId: string,
  card: { fingerprint: string; last4?: string; brand?: string },
  env: InviteEnv,
): Promise<{ ok: boolean; message: string }> {
  const admin = adminClient(env);
  if (!admin) throw new Error("Invite service is not configured.");
  const fingerprint = createHash("sha256").update(card.fingerprint).digest("hex");

  const { data: dup } = await admin
    .from("profiles")
    .select("id")
    .eq("card_fingerprint", fingerprint)
    .neq("id", userId)
    .maybeSingle();
  if (dup?.id) {
    return {
      ok: false,
      message: "That card is already on another SyNexus account. One card per customer.",
    };
  }

  const { error } = await admin
    .from("profiles")
    .update({
      card_verified: true,
      card_verified_at: new Date().toISOString(),
      card_fingerprint: fingerprint,
      card_last4: card.last4?.slice(-4) ?? null,
      card_brand: card.brand ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) {
    if (/unique|duplicate/i.test(error.message)) {
      return { ok: false, message: "That card is already on another SyNexus account." };
    }
    throw error;
  }

  await qualifyIfReady(admin, userId);
  return { ok: true, message: "Card verified." };
}

export function inviteAdmin(env: InviteEnv): SupabaseClient | null {
  return adminClient(env);
}
