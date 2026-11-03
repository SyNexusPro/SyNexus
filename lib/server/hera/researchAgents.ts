/**
 * Coordinates three specialist agents with LangChain runnables.
 * They read notes they were given. None of them can trade, unpause, or sign.
 */
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";

export type ResearchPacket = {
  question: string;
  market: string;
  security: string;
  history: string;
  brief: string;
};

function clip(value: string, max = 1200): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : "";
}

const marketAgent = RunnableLambda.from(async (packet: ResearchPacket): Promise<ResearchPacket> => {
  const note = clip(packet.market);
  return {
    ...packet,
    market: note || "Market specialist: no live market note was supplied. Do not invent prices.",
  };
});

const securityAgent = RunnableLambda.from(async (packet: ResearchPacket): Promise<ResearchPacket> => {
  const note = clip(packet.security);
  return {
    ...packet,
    security: note || "Security specialist: the requested checks were not run. Do not call the token safe.",
  };
});

const historyAgent = RunnableLambda.from(async (packet: ResearchPacket): Promise<ResearchPacket> => {
  const note = clip(packet.history);
  return {
    ...packet,
    history: note || "History specialist: no stored research or trade pattern was retrieved. Do not invent one.",
  };
});

const coordinator = RunnableLambda.from(async (packet: ResearchPacket): Promise<ResearchPacket> => ({
  ...packet,
  brief: [
    "RESEARCH COORDINATOR:",
    `Question: ${clip(packet.question, 300)}`,
    `Market: ${packet.market}`,
    `Security: ${packet.security}`,
    `History: ${packet.history}`,
    "The specialists cannot trade, unpause the bot, or sign a wallet. A missing note was not checked.",
  ].join("\n"),
}));

const researchChain = RunnableSequence.from([marketAgent, securityAgent, historyAgent, coordinator]);

export async function coordinateResearch(input: Omit<ResearchPacket, "brief">): Promise<string> {
  const result = await researchChain.invoke({ ...input, brief: "" });
  return result.brief;
}
