import {
  entitlementGrantsAccess,
  productTier,
  type MembershipTier,
} from "./policy.js";

export type RevenueCatAccess = {
  pantheon: boolean;
  nextLevel: boolean;
  productId: string | null;
  expiresAt: string | null;
  unsubscribeDetectedAt: string | null;
};

type EntitlementNode = {
  expires_date?: string | null;
  product_identifier?: string | null;
  unsubscribe_detected_at?: string | null;
};

function node(value: unknown): EntitlementNode | null {
  if (!value || typeof value !== "object") return null;
  return value as EntitlementNode;
}

export function readRevenueCatAccess(body: unknown, now: number): RevenueCatAccess {
  const subscriber = (body as { subscriber?: { entitlements?: Record<string, unknown>; subscriptions?: Record<string, unknown> } })
    ?.subscriber;
  const entitlements = subscriber?.entitlements ?? {};
  const pantheonNode = node(entitlements.pantheon);
  const nextNode = node(entitlements.next_level);
  const pantheon = entitlementGrantsAccess(
    { present: Boolean(pantheonNode), expiresDate: pantheonNode?.expires_date },
    now,
  );
  const nextLevel = entitlementGrantsAccess(
    { present: Boolean(nextNode), expiresDate: nextNode?.expires_date },
    now,
  );
  const activeNode = pantheon ? pantheonNode : nextLevel ? nextNode : null;
  const productId = activeNode?.product_identifier ?? null;
  const tier = productTier(productId);
  return {
    pantheon: pantheon || tier === "pantheon",
    nextLevel: nextLevel || tier === "next_level",
    productId,
    expiresAt: activeNode?.expires_date ?? null,
    unsubscribeDetectedAt: activeNode?.unsubscribe_detected_at ?? null,
  };
}

export async function fetchRevenueCatAccess(
  appUserId: string,
  secret: string,
  now = Date.now(),
): Promise<RevenueCatAccess | null> {
  if (!secret.trim() || !appUserId.trim()) return null;
  try {
    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: { Authorization: `Bearer ${secret.trim()}`, Accept: "application/json" },
    });
    if (!response.ok) return null;
    return readRevenueCatAccess(await response.json(), now);
  } catch {
    return null;
  }
}

export function tierFromAccess(access: RevenueCatAccess | null): MembershipTier | null {
  if (!access) return null;
  if (access.pantheon) return "pantheon";
  if (access.nextLevel) return "next_level";
  return null;
}
