/** Minimal dev-server type — avoids importing `vite` in Vercel serverless handlers. */
import type { IncomingMessage, ServerResponse } from "node:http";

export type ConnectNext = (err?: unknown) => void;

/**
 * Connect-style middleware with Node HTTP types.
 * Do not use `unknown` here — Vercel tsc infers unannotated `req` from this signature.
 */
export type ConnectHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  next: ConnectNext,
) => void | Promise<void>;

export type ViteDevServer = {
  middlewares: {
    use(path: string, handler: ConnectHandler): void;
    use(handler: ConnectHandler): void;
  };
};

/** Register middleware with explicit Node HTTP types (no `req: unknown` inference). */
export function useApiRoute(server: ViteDevServer, path: string, handler: ConnectHandler): void {
  server.middlewares.use(path, handler);
}
