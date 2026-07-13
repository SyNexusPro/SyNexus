/** Minimal dev-server type — avoids importing `vite` in Vercel serverless handlers. */
export type ViteDevServer = {
  middlewares: {
    use(
      path: string,
      handler: (req: unknown, res: unknown, next: () => void) => void | Promise<void>,
    ): void;
  };
};
