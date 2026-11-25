import type { IncomingMessage } from "node:http";
import { resolveTitanAuthPlan } from "../titan/authPlan.js";
import { isPaddleLiveCheckoutEnabled, isPaddleServerConfigured } from "../subscription/paddleEnv.js";
import {
  complimentaryTrialActive,
  developerAccessAllowed,
  membershipFeeBps,
  pickMembershipTier,
  productTier,
  profilePlanForTier,
  socialNetworkAllowed,
  type MembershipTier,
} from "./policy.js";
import { isRevenueCatArchived } from "./revenuecatArchive.js";
import { fetchRevenueCatAccess } from "./revenuecat.js";
import { readMembershipRecord, storeStatusGrantsAccess, syncProfilePlan, trialEndsAt } from "./store.js";

type Env = Record<string, string | undefined>;

export type MembershipSnapshot = {
  userId: string | null;
  authenticated: boolean;
  owner: boolean;
  developer: boolean;
  tier: MembershipTier;
  source: "owner" | "paddle" | "revenuecat" | "complimentary_trial" | "none";
  social: boolean;
  feeBps: number;
  feeDisclosure: string;
  trialEndsAt: string | null;
  trialEligible: boolean;
  storeProductId: string | null;
  storeStatus: string | null;
  paddleCustomerId: string | null;
  webCheckout: "paddle" | "disabled";
  manageSubscription: boolean;
  verification: "live" | "unavailable";
};

const FEE_DISCLOSURE_PAID =
  "SyNexus charges its own swap fee on top of the quote. Solana network fees and fees charged by other venues still apply, and SyNexus does not keep those.";
const FEE_DISCLOSURE_NONE =
  "SyNexus charges no swap fee on this membership. Solana network fees and fees charged by other venues still apply, and SyNexus does not keep those.";

function snapshot(
  partial: Omit<
    MembershipSnapshot,
    "feeDisclosure" | "webCheckout" | "developer" | "social" | "feeBps" | "manageSubscription" | "trialEligible"
  > & {
    developer?: boolean;
    trialEligible?: boolean;
    manageSubscription?: boolean;
    webCheckout?: "paddle" | "disabled";
  },
  env: Env,
): MembershipSnapshot {
  const owner = partial.owner;
  const paddleReady = isPaddleServerConfigured(env) && isPaddleLiveCheckoutEnabled(env);
  return {
    ...partial,
    developer: developerAccessAllowed(owner),
    social: socialNetworkAllowed(partial.tier, owner),
    feeBps: membershipFeeBps(partial.tier, owner),
    feeDisclosure: membershipFeeBps(partial.tier, owner) === 0 ? FEE_DISCLOSURE_NONE : FEE_DISCLOSURE_PAID,
    trialEligible: partial.trialEligible ?? false,
    manageSubscription: partial.manageSubscription ?? Boolean(partial.paddleCustomerId),
    webCheckout: partial.webCheckout ?? (paddleReady ? "paddle" : "disabled"),
  };
}

export async function resolveMembership(req: IncomingMessage, env: Env, now = Date.now()): Promise<MembershipSnapshot> {
  const auth = await resolveTitanAuthPlan(req, env);
  if (auth.owner) {
    if (auth.userId) await syncProfilePlan(env, auth.userId, profilePlanForTier("pantheon", true));
    return snapshot(
      {
        userId: auth.userId,
        authenticated: true,
        owner: true,
        tier: "pantheon",
        source: "owner",
        trialEndsAt: null,
        storeProductId: null,
        storeStatus: "owner",
        paddleCustomerId: null,
        verification: "live",
        trialEligible: false,
      },
      env,
    );
  }
  if (!auth.authenticated || !auth.userId) {
    return snapshot(
      {
        userId: null,
        authenticated: false,
        owner: false,
        tier: "free",
        source: "none",
        trialEndsAt: null,
        storeProductId: null,
        storeStatus: null,
        paddleCustomerId: null,
        verification: "live",
        trialEligible: false,
      },
      env,
    );
  }

  const rcArchived = isRevenueCatArchived(env);
  const secret = rcArchived ? "" : env.REVENUECAT_SECRET_API_KEY?.trim() || env.REVENUECAT_API_KEY?.trim() || "";
  const live = secret ? await fetchRevenueCatAccess(auth.userId, secret, now) : null;
  const record = await readMembershipRecord(env, auth.userId);

  const ledgerActive = storeStatusGrantsAccess(record?.storeStatus, record?.storeExpiresAt ?? null, now);
  const ledgerTier = ledgerActive ? productTier(record?.storeProductId) : null;
  const ledgerPantheon = ledgerTier === "pantheon";
  const ledgerNext = ledgerTier === "next_level";

  const complimentary = complimentaryTrialActive(record?.trialStartedAt ?? null, record?.trialUsed ?? false, now);
  const pantheon = live?.pantheon === true || ledgerPantheon;
  const nextLevel = live?.nextLevel === true || ledgerNext;
  const trial = complimentary && !pantheon && !nextLevel;
  const tier = pickMembershipTier({ owner: false, pantheon, nextLevel, trial });

  const fromPaddleLedger = ledgerActive && Boolean(record?.paddleCustomerId || record?.paddleSubscriptionId);
  const fromRevenueCat = live?.pantheon === true || live?.nextLevel === true;
  let resolvedSource: MembershipSnapshot["source"] = "none";
  if (pantheon || nextLevel) {
    resolvedSource = fromPaddleLedger ? "paddle" : fromRevenueCat ? "revenuecat" : ledgerActive ? "paddle" : "revenuecat";
  } else if (trial) {
    resolvedSource = "complimentary_trial";
  }

  if ((secret && live) || resolvedSource === "complimentary_trial" || resolvedSource === "paddle") {
    await syncProfilePlan(env, auth.userId, profilePlanForTier(tier, false));
  }

  const trialEligible = !(record?.trialUsed || pantheon || nextLevel || complimentary);

  return snapshot(
    {
      userId: auth.userId,
      authenticated: true,
      owner: false,
      tier,
      source: resolvedSource,
      trialEndsAt:
        resolvedSource === "complimentary_trial"
          ? trialEndsAt(record?.trialStartedAt ?? null)
          : record?.storeExpiresAt ?? live?.expiresAt ?? null,
      storeProductId: record?.storeProductId ?? live?.productId ?? null,
      storeStatus:
        record?.storeStatus ??
        (live?.unsubscribeDetectedAt ? "canceled" : fromRevenueCat ? "active" : null),
      paddleCustomerId: record?.paddleCustomerId ?? null,
      verification: secret || isPaddleServerConfigured(env) ? (live || record ? "live" : "unavailable") : "unavailable",
      trialEligible,
      manageSubscription: Boolean(record?.paddleCustomerId),
    },
    env,
  );
}
