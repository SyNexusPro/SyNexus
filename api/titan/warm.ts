import type { IncomingMessage, ServerResponse } from "node:http";
import { handleTitanWarm } from "./chat.js";

type ServerlessRequest = IncomingMessage & {
  method?: string;
};

type ServerlessResponse = ServerResponse;

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  await handleTitanWarm(req, res, process.env);
}
