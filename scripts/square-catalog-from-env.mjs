#!/usr/bin/env node
/** Square catalog lookup using process.env only (for `vercel env run`). */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
void root;

const env = process.env;
const token = env.SQUARE_ACCESS_TOKEN?.trim();
const apiBase = (env.SQUARE_API_BASE?.trim() || "https://connect.squareup.com").replace(/\/$/, "");

if (!token) {
  console.error("SQUARE_ACCESS_TOKEN missing from environment.");
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

const locationRes = await fetch(`${apiBase}/v2/locations`, { headers });
const locationData = await locationRes.json();
if (!locationRes.ok) {
  console.error("Square auth failed:", JSON.stringify(locationData, null, 2));
  process.exit(1);
}

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

function planMatches(name) {
  const n = normalizeName(name);
  return n.includes("synexus") || n.includes("hivemind") || n.includes("hive-mind");
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

if (!matchPlan || !matchVar) {
  console.error("Subscription plans in Square catalog:");
  for (const plan of plans) {
    console.error(`- ${plan.subscription_plan_data?.name ?? "(unnamed)"}  plan=${plan.id}`);
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

const locationId = env.SQUARE_LOCATION_ID?.trim() || locationData.locations?.[0]?.id?.trim() || "";

console.log(`Plan ID: ${matchPlan.id}`);
console.log(`Plan Variation ID: ${matchVar.id}`);
console.log(`Monthly price: ${monthlyPrice}`);
console.log(`Catalog Object ID: ${matchPlan.id}`);
console.log(`Plan name in Square: ${matchPlan.subscription_plan_data?.name ?? ""}`);
console.log("");
console.log("SQUARE_PLAN_VARIATION_ID_PRO=" + matchVar.id);
console.log("SQUARE_LOCATION_ID=" + locationId);
