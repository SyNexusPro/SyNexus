import type { ViteDevServer } from "./viteDevServer";
import {
  createSubscriptionCheckoutResponse,
  type CheckoutPayload,
  type JsonResponse,
} from "../server/subscription/checkout";

type ServerlessRequest = NodeJS.ReadableStream & {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ServerlessResponse = {
  status(statusCode: number): ServerlessResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

function readRequestBody(req: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function configureCheckoutApi(server: ViteDevServer, env: Record<string, string | undefined>) {
  server.middlewares.use("/api/checkout", async (req, res, next) => {
    if (req.method !== "POST") {
      next();
      return;
    }

    try {
      const payload = JSON.parse(await readRequestBody(req)) as CheckoutPayload;
      const result = await createSubscriptionCheckoutResponse(payload, req.headers, env);
      res.statusCode = result.statusCode;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result.body));
    } catch {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: "Checkout is temporarily unavailable. Please try again shortly.",
        }),
      );
    }
  });
}

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const payload =
      typeof req.body === "string"
        ? (JSON.parse(req.body) as CheckoutPayload)
        : (req.body as CheckoutPayload | undefined) ?? {};
    const result: JsonResponse = await createSubscriptionCheckoutResponse(
      payload,
      req.headers,
      process.env,
    );
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("[checkout]", error);
    res.status(500).json({
      error: "Checkout is temporarily unavailable. Please try again shortly.",
    });
  }
}
