/**
 * Verify Birdeye API key for Titan week/month/year movers.
 *   npm run birdeye:check
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BONK_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

function readPrice(item) {
  return item?.value ?? item?.price ?? item?.close ?? item?.c ?? null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const env = {
    ...readEnvFile(join(root, ".env")),
    ...process.env,
  };
  const apiKey = env.VITE_BIRDEYE_API_KEY?.trim();
  if (!apiKey) {
    console.error("FAIL — VITE_BIRDEYE_API_KEY missing (.env or environment).");
    process.exit(1);
  }

  console.log(`OK — VITE_BIRDEYE_API_KEY present (${apiKey.length} chars).`);

  const now = Math.floor(Date.now() / 1000);
  const checks = [
    { label: "7d (1H candles)", seconds: 7 * 86400, type: "1H", minPoints: 24 },
    { label: "30d (1D candles)", seconds: 30 * 86400, type: "1D", minPoints: 7 },
    { label: "365d (1W candles)", seconds: 365 * 86400, type: "1W", minPoints: 4 },
  ];

  for (const check of checks) {
    const from = now - check.seconds;
    const params = new URLSearchParams({
      address: BONK_MINT,
      address_type: "token",
      type: check.type,
      time_from: String(from),
      time_to: String(now),
    });
    const response = await fetch(`https://public-api.birdeye.so/defi/history_price?${params}`, {
      headers: {
        "X-API-KEY": apiKey,
        "x-chain": "solana",
      },
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`FAIL — ${check.label}: HTTP ${response.status} ${detail.slice(0, 160)}`);
      process.exit(1);
    }

    const data = await response.json();
    const items = data?.data?.items ?? [];
    if (items.length < check.minPoints) {
      console.error(`FAIL — ${check.label}: expected ≥${check.minPoints} points, got ${items.length}`);
      process.exit(1);
    }

    const first = readPrice(items[0]);
    const last = readPrice(items[items.length - 1]);
    const pct =
      first && last && first > 0 ? (((last - first) / first) * 100).toFixed(2) : "—";
    console.log(`OK — ${check.label}: ${items.length} points · sample change ${pct}%`);
    await sleep(1200);
  }

  console.log("\nBirdeye ready — Titan week/month/year top movers will use live history.");
}

main().catch((error) => {
  console.error("FAIL —", error instanceof Error ? error.message : error);
  process.exit(1);
});
