import Stripe from "stripe";
import type { ViteDevServer } from "vite";

type PaidPlan = "PRO" | "PREMIUM";

type CheckoutEnv = {
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_ID_PRO?: string;
  STRIPE_PRICE_ID_PREMIUM?: string;
  VITE_APP_URL?: string;
};

function readRequestBody(req: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function configureStripeCheckoutApi(server: ViteDevServer, env: CheckoutEnv) {
  server.middlewares.use("/api/stripe/checkout", async (req, res, next) => {
    if (req.method !== "POST") {
      next();
      return;
    }

    const secretKey = env.STRIPE_SECRET_KEY;
    const proPriceId = env.STRIPE_PRICE_ID_PRO;
    const premiumPriceId = env.STRIPE_PRICE_ID_PREMIUM;

    if (!secretKey || !proPriceId || !premiumPriceId) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error:
            "Stripe env is missing. Set STRIPE_SECRET_KEY, STRIPE_PRICE_ID_PRO, STRIPE_PRICE_ID_PREMIUM.",
        }),
      );
      return;
    }

    try {
      const payload = JSON.parse(await readRequestBody(req)) as {
        plan?: PaidPlan;
        email?: string;
        userId?: string;
      };
      const plan = payload.plan;

      if (plan !== "PRO" && plan !== "PREMIUM") {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid plan" }));
        return;
      }

      const stripe = new Stripe(secretKey);
      const priceId = plan === "PRO" ? proPriceId : premiumPriceId;
      const requestOrigin = getHeaderValue(req.headers.origin);
      const requestHost = getHeaderValue(req.headers.host);
      const appUrl =
        requestOrigin ||
        env.VITE_APP_URL ||
        (requestHost ? `http://${requestHost}` : "http://localhost:5173");
      const userId = payload.userId?.trim();

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/pulse?checkout=success&plan=${plan}`,
        cancel_url: `${appUrl}/pulse?checkout=cancel`,
        customer_email: payload.email || undefined,
        metadata: {
          plan,
          userId: userId || "anonymous",
        },
      };

      if (userId) {
        sessionParams.client_reference_id = userId;
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ url: session.url }));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Failed to create checkout session",
        }),
      );
    }
  });
}
