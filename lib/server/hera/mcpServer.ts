/**
 * Minimal MCP JSON-RPC for approved read-only tools.
 * initialize, tools/list, and tools/call. Nothing else is implemented.
 */
import { callApprovedTool, listApprovedTools, type ApprovedRunners } from "./approvedTools.js";

type Rpc = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };

export async function dispatchMcp(
  body: unknown,
  runners: ApprovedRunners,
): Promise<{ status: number; json: unknown }> {
  const rpc = body && typeof body === "object" ? body as Rpc : {};
  const id = rpc.id ?? null;
  const method = typeof rpc.method === "string" ? rpc.method : "";
  if (method === "initialize") {
    return {
      status: 200,
      json: {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "hera", version: "1" },
          instructions: "Approved read-only tools only. Hera cannot trade, unpause, or sign.",
        },
      },
    };
  }
  if (method === "tools/list") {
    return { status: 200, json: { jsonrpc: "2.0", id, result: { tools: listApprovedTools() } } };
  }
  if (method === "tools/call") {
    const params = rpc.params && typeof rpc.params === "object" ? rpc.params as { name?: unknown; arguments?: unknown } : {};
    const name = typeof params.name === "string" ? params.name : "";
    const called = await callApprovedTool(name, params.arguments ?? {}, runners);
    if (!called.ok) {
      return {
        status: 200,
        json: {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: called.error }], isError: true },
        },
      };
    }
    return {
      status: 200,
      json: {
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: called.text }], isError: false },
      },
    };
  }
  return { status: 200, json: { jsonrpc: "2.0", id, error: { code: -32601, message: "method_not_found" } } };
}
