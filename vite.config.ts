import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { configureStripeCheckoutApi } from "./api/checkout";
import { configureOwnerUnlockApi } from "./api/ownerUnlock";
import { configureAnalyticsApi } from "./api/analytics";
import { configureStripeWebhookApi } from "./api/webhook";

/** Client bundle reads only VITE_* from import.meta.env; Vercel often sets SUPABASE_* without the prefix. */
function resolveSupabaseForClientBuild(mode: string) {
  const viteEnv = loadEnv(mode, process.cwd(), "VITE");
  const merged = { ...process.env, ...viteEnv } as Record<string, string | undefined>;
  const rawUrl = merged.VITE_SUPABASE_URL || merged.SUPABASE_URL || "";
  const rawAnon = merged.VITE_SUPABASE_ANON_KEY || merged.SUPABASE_ANON_KEY || "";
  const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
  const anon = typeof rawAnon === "string" ? rawAnon.trim() : "";
  return { url, anon };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const { url: supabaseUrl, anon: supabaseAnon } = resolveSupabaseForClientBuild(mode);

  return {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabaseAnon),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return;
            }
            if (id.includes("@supabase")) {
              return "supabase";
            }
            if (id.includes("react-dom")) {
              return "react-dom";
            }
            if (id.includes("react-router")) {
              return "react-router";
            }
            if (id.includes("/react/")) {
              return "react";
            }
          },
        },
      },
    },
    plugins: [
      react(),
      {
        name: "stripe-checkout-api",
        configureServer(server) {
          configureStripeCheckoutApi(server, env);
          configureStripeWebhookApi(server, env);
          configureOwnerUnlockApi(server, env);
          configureAnalyticsApi(server);
        },
      },
    ],
  };
});
