/**
 * The only external tools Hera and the MCP endpoint may call.
 * Trading, signing, and pause changes are not tools.
 */
import { loadAlexusLearningBrief } from "./alexusLearning.js";
import { recallMemory, formatMemoryHits } from "./memory.js";
import { compareSolanaRoute, type RouteComparison } from "./routeCompare.js";
import { fetchVenueDeskBrief } from "./venueDesk.js";

export type ToolText = { ok: true; text: string } | { ok: false; error: "tool_not_approved" | "bad_arguments" };

export type ApprovedRunners = {
  venueDesk: () => Promise<string>;
  alexusLearning: () => Promise<string>;
  routeCompare: (mint: string) => Promise<RouteComparison>;
  memorySearch: (query: string) => Promise<string>;
};

const APPROVED = [
  { name: "venue_desk", description: "Read public last prices from major venues. No orders." },
  { name: "alexus_learning", description: "Read Alexus paper lessons. Not a trade instruction." },
  { name: "route_compare", description: "Compare a Jupiter round-trip quote with the GMGN fee schedule. Quote only." },
  { name: "memory_search", description: "Retrieve previous Hera research and stored trade-pattern notes." },
] as const;

export type ApprovedToolName = (typeof APPROVED)[number]["name"];

const REFUSED = /^(swap|trade|order|unpause|sign|resume|arm)$/i;

export function listApprovedTools(): { name: ApprovedToolName; description: string }[] {
  return APPROVED.map((tool) => ({ name: tool.name, description: tool.description }));
}

export function defaultRunners(env: Record<string, string | undefined>): ApprovedRunners {
  return {
    venueDesk: () => fetchVenueDeskBrief(),
    alexusLearning: () => loadAlexusLearningBrief(env),
    routeCompare: (mint) => compareSolanaRoute(mint, env),
    memorySearch: async (query) => formatMemoryHits(await recallMemory(env, query)),
  };
}

export async function callApprovedTool(
  name: string,
  args: unknown,
  runners: ApprovedRunners,
): Promise<ToolText> {
  if (REFUSED.test(name) || !APPROVED.some((tool) => tool.name === name)) {
    return { ok: false, error: "tool_not_approved" };
  }
  const record = args && typeof args === "object" ? args as Record<string, unknown> : {};
  if (name === "venue_desk") return { ok: true, text: await runners.venueDesk() };
  if (name === "alexus_learning") return { ok: true, text: await runners.alexusLearning() };
  if (name === "memory_search") {
    const query = typeof record.query === "string" ? record.query.trim() : "";
    if (query.length < 3) return { ok: false, error: "bad_arguments" };
    return { ok: true, text: await runners.memorySearch(query) };
  }
  const mint = typeof record.mint === "string" ? record.mint.trim() : "";
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) return { ok: false, error: "bad_arguments" };
  const route = await runners.routeCompare(mint);
  return { ok: true, text: route.note };
}
