import { authHeaders } from "../../lib/authSession";

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

export async function fetchCommunityAccess(
  signal?: AbortSignal,
): Promise<CommunityAccess> {
  const response = await fetch("/api/community/access", {
    method: "GET",
    headers: await authHeaders(),
    cache: "no-store",
    signal,
  });
  const body = (await response.json().catch(() => null)) as CommunityAccess | null;
  if (body && typeof body.authorized === "boolean") return body;
  throw new Error("Community access check is unavailable.");
}
