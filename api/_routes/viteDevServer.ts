/** Minimal dev-server type — avoids importing `vite` in Vercel serverless handlers. */
import type { IncomingMessage, ServerResponse } from "node:http";

export type ConnectNext = () => void;

export type ConnectHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  next: ConnectNext,
) => void | Promise<void>;

export type ViteDevServer = {
  middlewares: {
    use(path: string, handler: ConnectHandler): void;
  };
};
