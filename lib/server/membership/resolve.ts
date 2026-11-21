import type { IncomingMessage } from "node:http";
import { resolveTitanAuthPlan } from "../titan/authPlan.js";
import {
  complimentaryTrialActive,
  developerAccessAllowed,
  membershipFeeBps,
  pickMembershipTier,
  profilePlanForTier,
  socialNetworkAllowed,
  type MembershipTier,
} from "./policy.js";
import { fetchRevenueCatAccess } from "./revenuecat.js";
import { readMembershipRecord, syncProfilePlan, trialEndsAt } from "./store.js";

type Env = Record<string, string | undefined>;

export type MembershipSnapshot = {
  userId: string | null;
  authenticated: boolean;
  owner: boolean;
  developer: boolean;
  tier: MembershipTier;
  source: "owner" | "revenuecat" | "complimentary_trial" | "none";
  social: boolean;
  feeBps: number;
  feeDisclosure: string;
  trialEndsAt: string | null;
  storeProductId: string | null;
  storeStatus: string | null;
  webCheckout: "disabled";
  verification: "live" | "unavailable";
};

const FEE_DISCLOSURE_PAID =
  "SyNexus charges its own swap fee on top of the quote. Solana network fees and fees charged by other venues still apply, and SyNexus does not keep those.";
const FEE_DISCLOSURE_NONE =
  "SyNexus charges no swap fee on this membership. Solana network fees and fees charged by other venues still apply, and SyNexus does not keep those.";

function snapshot(partial: Omit<MembershipSnapshot, "feeDisclosure" | "webCheckout" | "developer" | "social" | "feeBps"> & {
  developer?: boolean;
}): MembershipSnapshot {
  const owner = partial.owner;
  return {
    ...partial,
    developer: developerAccessAllowed(owner),
    social: socialNetworkAllowed(partial.tier, owner),
    feeBps: membershipFeeBps(partial.tier, owner),
    feeDisclosure: membershipFeeBps(partial.tier, owner) === 0 ? FEE_DISCLOSURE_NONE : FEE_DISCLOSURE_PAID,
    webCheckout: "disabled",
  };
}

export async function resolveMembership(req: IncomingMessage, env: Env, now = Date.now()): Promise<MembershipSnapshot> {
  const auth = await resolveTitanAuthPlan(req, env);
  if (auth.owner) {
    if (auth.userId) await syncProfilePlan(env, auth.userId, profilePlanForTier("pantheon", true));
    return snapshot({
      userId: auth.userId,
      authenticated: true,
      owner: true,
      tier: "pantheon",
      source: "owner",
      trialEndsAt: null,
      storeProductId: null,
      storeStatus: "owner",
      verification: "live",
    });
  }
  if (!auth.authenticated || !auth.userId) {
    return snapshot({
      userId: null,
      authenticated: false,
      owner: false,
      tier: "free",
      source: "none",
      trialEndsAt: null,
      storeProductId: null,
      storeStatus: null,
      verification: "live",
    });
  }

  const secret = env.REVENUECAT_SECRET_API_KEY?.trim() || env.REVENUECAT_API_KEY?.trim() || "";
  const live = secret ? await fetchRevenueCatAccess(auth.userId, secret, now) : null;
  const record = await readMembershipRecord(env, auth.userId);
  const trial = complimentaryTrialActive(record?.trialStartedAt ?? null, record?.trialUsed ?? false, now);
  const pantheon = live?.pantheon === true;
  const nextLevel = live?.nextLevel === true;
  const tier = pickMembershipTier({ owner: false, pantheon, nextLevel, trial: trial && !pantheon && !nextLevel });
  const source = pantheon || nextLevel ? "revenuecat" : trial ? "complimentary_trial" : "none";
  if ((secret && live) || source === "complimentary_trial") {
    await syncProfilePlan(env, auth.userId, profilePlanForTier(tier, false));
  }

  return snapshot({
    userId: auth.userId,
    authenticated: true,
    owner: false,
    tier,
    source,
    trialEndsAt: source === "complimentary_trial" ? trialEndsAt(record?.trialStartedAt ?? null) : live?.expiresAt ?? null,
    storeProductId: live?.productId ?? record?.storeProductId ?? null,
    storeStatus: live?.unsubscribeDetectedAt ? "canceled" : record?.storeStatus ?? (source === "revenuecat" ? "active" : null),
    verification: secret ? (live ? "live" : "unavailable") : "unavailable",
  });
}
