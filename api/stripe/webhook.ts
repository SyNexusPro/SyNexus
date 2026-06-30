import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import type { ViteDevServer } from "vite";
import { processStripeTreasuryEvent } from "../treasuryRevenue";

type PaidPlan = "PRO";

type WebhookEnv = {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

function readRawBody(req: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getCheckoutPlan(session: Stripe.Checkout.Session): PaidPlan | null {
  const plan = session.metadata?.plan;
  return plan === "PRO" ? plan : null;
}

function getCheckoutUserId(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id || session.metadata?.userId;
  return userId && userId !== "anonymous" ? userId : null;
}

export async function handleStripeWebhookRequest(
  rawBody: Buffer,
  signature: string | undefined,
  env: WebhookEnv,
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const stripeSecretKey = env.STRIPE_SECRET_KEY;
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return {
      statusCode: 500,
      body: {
        error:
          "Webhook env is missing. Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.",
      },
    };
  }

  if (!signature) {
    return { statusCode: 400, body: { error: "Missing Stripe signature" } };
  }

  const stripe = new Stripe(stripeSecretKey);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    return {
      statusCode: 400,
      body: { error: `Webhook signature verification failed: ${(error as Error).message}` },
    };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const plan = getCheckoutPlan(session);
    const userId = getCheckoutUserId(session);

    if (plan && userId) {
      const { error } = await supabase.from("profiles").upsert({
        id: userId,
        paid_plan: plan,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        throw error;
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata?.userId;
    if (userId && userId !== "anonymous") {
      const { error } = await supabase.from("profiles").upsert({
        id: userId,
        paid_plan: "FREE",
        updated_at: new Date().toISOString(),
      });
      if (error) {
        throw error;
      }
    }
  }

  let treasury: Awaited<ReturnType<typeof processStripeTreasuryEvent>> | undefined;
  try {
    treasury = await processStripeTreasuryEvent(event);
  } catch (treasuryError) {
    console.error("[treasury]", treasuryError);
    treasury = { logged: false, reason: "treasury_error" };
  }

  return {
    statusCode: 200,
    body: {
      received: true,
      type: event.type,
      treasury,
    },
  };
}

export function configureStripeWebhookApi(server: ViteDevServer, env: WebhookEnv) {
  server.middlewares.use("/api/stripe/webhook", async (req, res, next) => {
    if (req.method !== "POST") {
      next();
      return;
    }

    try {
      const signature = getHeaderValue(req.headers["stripe-signature"]);
      const rawBody = await readRawBody(req);
      const result = await handleStripeWebhookRequest(rawBody, signature, env);
      res.statusCode = result.statusCode;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result.body));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Failed to process webhook",
        }),
      );
    }
  });
}

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

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const rawBody =
      typeof req.body === "string"
        ? Buffer.from(req.body, "utf8")
        : Buffer.isBuffer(req.body)
          ? req.body
          : await readRawBody(req);

    const signature = getHeaderValue(req.headers["stripe-signature"]);
    const result = await handleStripeWebhookRequest(rawBody, signature, process.env);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to process webhook",
    });
  }
}

/** Vercel / legacy: disable JSON body parser so Stripe signature verification works. */
export const config = {
  api: {
    bodyParser: false,
  },
};
