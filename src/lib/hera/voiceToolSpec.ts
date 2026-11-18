/**
 * Tools the live voice session may call. Trading, signing, and pause changes are absent on purpose.
 */

export type VoiceToolSpec = {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: "string"; description: string }>;
    required: string[];
    additionalProperties: false;
  };
};

export const HERA_VOICE_TOOLS: readonly VoiceToolSpec[] = [
  {
    type: "function",
    name: "memory_search",
    description: "Retrieve stored Hera research notes for this question. Use only when prior research would change the answer.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "The question to search, in the person's words." } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "venue_desk",
    description: "Read public last prices from major venues. No orders.",
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    type: "function",
    name: "alexus_learning",
    description: "Read Alexus paper-trading lessons. Not a trade instruction and not a change to her settings.",
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    type: "function",
    name: "route_compare",
    description: "Compare a Jupiter round-trip quote with the GMGN fee schedule. Quote only. No swap.",
    parameters: {
      type: "object",
      properties: { mint: { type: "string", description: "Solana mint address." } },
      required: ["mint"],
      additionalProperties: false,
    },
  },
];

export const HERA_TOOL_LINE =
  "You can look up stored research, public venue prices, Alexus paper lessons, and a quote comparison. " +
  "Call a tool only when the answer depends on it. A greeting or a question you can answer directly needs no tool. " +
  "If a tool says unavailable or empty, say that. Do not claim a lookup you did not receive. Do not place a trade.";
