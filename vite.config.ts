import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { configureStripeCheckoutApi } from "./api/checkout";
import { configureStripeWebhookApi } from "./api/webhook";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      {
        name: "stripe-checkout-api",
        configureServer(server) {
          configureStripeCheckoutApi(server, env);
          configureStripeWebhookApi(server, env);
        },
      },
    ],
  };
});
