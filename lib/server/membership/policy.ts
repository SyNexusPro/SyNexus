import { timingSafeEqual } from "node:crypto";

export type MembershipTier = "free" | "next_level" | "pantheon";

export const COMPLIMENTARY_TRIAL_DAYS = 30;

export const MEMBERSHIP_FEE_BPS: Record<MembershipTier, number> = {
  free: 10,
  next_level: 5,
  pantheon: 0,
};

const NEXT_LEVEL_PRODUCTS = new Set(["next_level_monthly", "next_level_annual"]);
const PANTHEON_PRODUCTS = new Set(["the_pantheon_monthly"]);

export function productTier(storeIdentifier: string | null | undefined): MembershipTier | null {
  const id = storeIdentifier?.trim() ?? "";
  if (PANTHEON_PRODUCTS.has(id)) return "pantheon";
  if (NEXT_LEVEL_PRODUCTS.has(id)) return "next_level";
  return null;
}

export function entitlementIsActive(expiresDate: string | null | undefined, now: number): boolean {
  if (expiresDate == null) return false;
  const expires = Date.parse(expiresDate);
  return Number.isFinite(expires) && expires > now;
}

/** A RevenueCat lifetime entitlement has no expiry. A missing entitlement does not. */
export function entitlementGrantsAccess(input: { present: boolean; expiresDate: string | null | undefined }, now: number): boolean {
  if (!input.present) return false;
  if (input.expiresDate == null || input.expiresDate === "") return true;
  return entitlementIsActive(input.expiresDate, now);
}

export function complimentaryTrialActive(startedAt: string | null, used: boolean, now: number): boolean {
  if (!used || !startedAt) return false;
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) return false;
  return now < start + COMPLIMENTARY_TRIAL_DAYS * 86_400_000;
}

export function pickMembershipTier(input: {
  owner: boolean;
  pantheon: boolean;
  nextLevel: boolean;
  trial: boolean;
}): MembershipTier {
  if (input.owner || input.pantheon) return "pantheon";
  if (input.nextLevel || input.trial) return "next_level";
  return "free";
}

export function membershipFeeBps(tier: MembershipTier, owner: boolean): number {
  if (owner) return 0;
  return MEMBERSHIP_FEE_BPS[tier];
}

export function socialNetworkAllowed(tier: MembershipTier, owner: boolean): boolean {
  return owner || tier === "pantheon";
}

/** Pantheon is a member plan. It never opens the owner command center. */
export function developerAccessAllowed(owner: boolean): boolean {
  return owner === true;
}

export function webhookAuthorized(header: string | undefined, secret: string): boolean {
  const expected = secret.trim();
  const raw = header?.trim() ?? "";
  if (!expected || !raw) return false;
  const presented = raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : raw;
  const left = Buffer.from(presented);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
