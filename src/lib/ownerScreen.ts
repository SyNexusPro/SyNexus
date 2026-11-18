/** Marker the private Hera phone app adds to its browser. A normal visit does not have it. */
export const OWNER_SCREEN_MARKER = "TitanHeraOwner";

export function isOwnerScreen(userAgent?: string): boolean {
  const agent = userAgent ?? (typeof navigator === "undefined" ? "" : navigator.userAgent);
  if (agent.includes(OWNER_SCREEN_MARKER)) return true;
  if (typeof window !== "undefined" && (window as { __titanHeraOwner?: boolean }).__titanHeraOwner) return true;
  return false;
}
