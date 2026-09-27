import type { IncomingMessage } from "node:http";
import {
  resolveTitanAuthPlan,
  supabaseAdminFromEnv,
} from "../titan/authPlan.js";

type Env = Record<string, string | undefined>;

export type CommunityAccessReason =
  | "authorized"
  | "feature_disabled"
  | "authentication_required"
  | "membership_required"
  | "database_not_ready"
  | "account_restricted";

export type CommunityAccess = {
  enabled: boolean;
  authorized: boolean;
  reason: CommunityAccessReason;
  userId: string | null;
  plan: "FREE" | "PRO";
  owner: boolean;
};

function serverFlagEnabled(env: Env): boolean {
  return env.COMMUNITY_ENABLED?.trim().toLowerCase() === "true";
}

export async function resolveCommunityAccess(
  req: IncomingMessage,
  env: Env,
): Promise<CommunityAccess> {
  const auth = await resolveTitanAuthPlan(req, env);
  const base = {
    userId: auth.userId,
    plan: auth.plan,
    owner: auth.owner === true,
  };

  if (!serverFlagEnabled(env)) {
    return {
      ...base,
      enabled: false,
      authorized: false,
      reason: "feature_disabled",
    };
  }
  if (!auth.authenticated) {
    return {
      ...base,
      enabled: true,
      authorized: false,
      reason: "authentication_required",
    };
  }
  if (auth.plan !== "PRO" && !auth.owner) {
    return {
      ...base,
      enabled: true,
      authorized: false,
      reason: "membership_required",
    };
  }

  const admin = supabaseAdminFromEnv(env);
  if (!admin) {
    return {
      ...base,
      enabled: true,
      authorized: false,
      reason: "database_not_ready",
    };
  }

  const { data: settings, error: settingsError } = await admin
    .from("community_settings")
    .select("enabled")
    .eq("id", true)
    .maybeSingle();
  if (settingsError || settings?.enabled !== true) {
    return {
      ...base,
      enabled: false,
      authorized: false,
      reason: settingsError ? "database_not_ready" : "feature_disabled",
    };
  }

  if (auth.userId) {
    const { data: trust, error: trustError } = await admin
      .from("user_trust_scores")
      .select("state, restricted_until")
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (trustError && trustError.code !== "PGRST116") {
      return {
        ...base,
        enabled: true,
        authorized: false,
        reason: "database_not_ready",
      };
    }
    const restrictedUntil = trust?.restricted_until
      ? Date.parse(String(trust.restricted_until))
      : 0;
    if (
      trust?.state === "banned" ||
      trust?.state === "suspended" ||
      (restrictedUntil > Date.now() &&
        (trust?.state === "limited" || trust?.state === "quarantined"))
    ) {
      return {
        ...base,
        enabled: true,
        authorized: false,
        reason: "account_restricted",
      };
    }
  }

  return {
    ...base,
    enabled: true,
    authorized: true,
    reason: "authorized",
  };
}
