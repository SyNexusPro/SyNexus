import type { CapacitorConfig } from "@capacitor/cli";

/** Production WebView origin — APIs (/api/*) live on Vercel, not in the bundled dist. */
const REMOTE_SERVER_URL =
  process.env.CAPACITOR_SERVER_URL?.trim() || "https://www.synexus.pro";

/** Set CAPACITOR_USE_LOCAL=1 to load bundled `dist/` instead (local UI testing only). */
const useRemoteServer = process.env.CAPACITOR_USE_LOCAL !== "1";

const config: CapacitorConfig = {
  appId: "com.synexus.app",
  appName: "Synexus",
  webDir: "dist",
  android: {
    backgroundColor: "#071007",
    allowMixedContent: false,
  },
  server: {
    androidScheme: "https",
    ...(useRemoteServer
      ? {
          url: REMOTE_SERVER_URL,
          cleartext: false,
        }
      : {}),
  },
};

export default config;
