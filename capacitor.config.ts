import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.synexus.app",
  appName: "Synexus",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
