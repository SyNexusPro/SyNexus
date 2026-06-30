import dotenv from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load marketing-ai/.env plus repo root .env (Supabase service role for treasury sync). */
export function loadMarketingEnv() {
  dotenv.config({ path: join(__dirname, "..", ".env"), quiet: true });
  dotenv.config({ path: join(__dirname, ".env"), quiet: true });
}
