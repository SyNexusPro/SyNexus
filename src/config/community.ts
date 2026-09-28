/**
 * Presentation flag only. Server and database gates remain authoritative.
 * Community stays hidden unless explicitly enabled at build time.
 */
export const COMMUNITY_BUILD_ENABLED =
  (import.meta.env.VITE_COMMUNITY_ENABLED ?? "").trim().toLowerCase() === "true";

export const COMMUNITY_PATH = "/community";
export const COMMUNITY_ENTRY_LABEL = "ENTER SYNEXUS";

export function isCommunityEnabled(): boolean {
  return COMMUNITY_BUILD_ENABLED;
}
