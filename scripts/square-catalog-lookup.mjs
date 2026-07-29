#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
  return out;
}

const fileEnv = readEnvFile(join(root, ".env"));
const env = {
  ...fileEnv,
  ...process.env,
  // Vercel `env run` loads local .env after cloud vars — prefer explicit CLI token when set.
  ...(process.env.SQUARE_ACCESS_TOKEN ? { SQUARE_ACCESS_TOKEN: process.env.SQUARE_ACCESS_TOKEN } : {}),
};

const planNameCandidates = [
  "SyNexus Pro",
  "SyNexusPro",
  "SyNexus",
  "Hive-Mind",
  "Hive Mind",
  "HiveMind",
];

const useSandbox =
  ["1", "true", "yes"].includes(env.SQUARE_USE_SANDBOX?.trim().toLowerCase() ?? "") ||
  env.SQUARE_API_BASE?.includes("squareupsandbox.com");

const token = (useSandbox ? env.SQUARE_SANDBOX_ACCESS_TOKEN : env.SQUARE_ACCESS_TOKEN)?.trim();
const apiBase = (
  env.SQUARE_API_BASE?.trim() ||
  (useSandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com")
).replace(/\/$/, "");

if (!token) {
  console.error("Missing SQUARE_ACCESS_TOKEN (or sandbox token).");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "Square-Version": "2026-05-20",
  "Content-Type": "application/json",
};

function normalizeName(value) {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

async function listSubscriptionPlans() {
  const plans = [];
  let cursor;

  do {
    const url = new URL(`${apiBase}/v2/catalog/list`);
    url.searchParams.set("types", "SUBSCRIPTION_PLAN");
    if (cursor) url.searchParams.set("cursor", cursor);

    const response = await fetch(url, { headers });
    const data = await response.json();
    if (!response.ok) {
      console.error(JSON.stringify(data, null, 2));
      process.exit(1);
    }

    plans.push(...(data.objects ?? []));
    cursor = data.cursor;
  } while (cursor);

  return plans;
}

const locationRes = await fetch(`${apiBase}/v2/locations`, { headers });
const locationData = await locationRes.json();
if (!locationRes.ok) {
  console.error("Square auth failed:", JSON.stringify(locationData, null, 2));
  process.exit(1);
}

const plans = await listSubscriptionPlans();
const normalizedCandidates = new Set(planNameCandidates.map(normalizeName));

function planMatches(name) {
  const n = normalizeName(name);
  if (normalizedCandidates.has(n)) return true;
  if (n.includes("synexus")) return true;
  return false;
}

let matchPlan = null;
let matchVar = null;

for (const plan of plans) {
  const name = plan.subscription_plan_data?.name ?? "";
  if (planMatches(name)) {
    matchPlan = plan;
    const variations = plan.subscription_plan_data?.subscription_plan_variations ?? [];
    matchVar =
      variations.find((v) => /pro/i.test(v.subscription_plan_variation_data?.name ?? "")) ??
      variations[0] ??
      null;
    break;
  }
}

// Fallback: fetch configured variation/plan id directly from catalog.
if (!matchPlan && env.SQUARE_PLAN_VARIATION_ID_PRO?.trim()) {
  const configuredId = env.SQUARE_PLAN_VARIATION_ID_PRO.trim();
  const objectRes = await fetch(`${apiBase}/v2/catalog/object/${encodeURIComponent(configuredId)}`, {
    headers,
  });
  const objectData = await objectRes.json();
  if (objectRes.ok && objectData.object) {
    const obj = objectData.object;
    if (obj.type === "SUBSCRIPTION_PLAN") {
      matchPlan = obj;
      matchVar = obj.subscription_plan_data?.subscription_plan_variations?.[0] ?? null;
    } else if (obj.type === "SUBSCRIPTION_PLAN_VARIATION") {
      matchVar = obj;
      const parentId = obj.subscription_plan_variation_data?.subscription_plan_id;
      if (parentId) {
        const parentRes = await fetch(`${apiBase}/v2/catalog/object/${encodeURIComponent(parentId)}`, {
          headers,
        });
        const parentData = await parentRes.json();
        if (parentRes.ok) matchPlan = parentData.object ?? null;
      }
    }
  }
}

if (!matchPlan || !matchVar) {
  console.error("Could not find plan 'SyNexus Pro'. Subscription plans in catalog:");
  for (const plan of plans) {
    console.error(`- ${plan.subscription_plan_data?.name ?? "(unnamed)"}  ${plan.id}`);
    for (const variation of plan.subscription_plan_data?.subscription_plan_variations ?? []) {
      console.error(
        `    variation ${variation.id}  ${variation.subscription_plan_variation_data?.name ?? ""}`,
      );
    }
  }
  process.exit(1);
}

const phases = matchVar.subscription_plan_variation_data?.phases ?? [];
const monthly =
  phases.find((phase) => String(phase.cadence ?? "").includes("MONTH")) ?? phases[0];

let monthlyPrice = "unknown";
if (monthly?.pricing?.type === "STATIC" && monthly.pricing.price_money) {
  const { amount, currency = "USD" } = monthly.pricing.price_money;
  monthlyPrice = `${(Number(amount) / 100).toFixed(2)} ${currency}`;
}

const locationId =
  env.SQUARE_LOCATION_ID?.trim() || locationData.locations?.[0]?.id?.trim() || "";

console.log(`Plan ID: ${matchPlan.id}`);
console.log(`Plan Variation ID: ${matchVar.id}`);
console.log(`Monthly price: ${monthlyPrice}`);
console.log(`Catalog Object ID: ${matchPlan.id}`);
console.log("");
console.log("SQUARE_PLAN_VARIATION_ID_PRO=" + matchVar.id);
console.log("SQUARE_LOCATION_ID=" + locationId);
