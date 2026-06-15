import dotenv from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load marketing-ai/.env for all CLI scripts. */
export function loadMarketingEnv() {
  dotenv.config({ path: join(__dirname, ".env"), quiet: true });
}
