#!/usr/bin/env node
/**
 * Create a Square Payment Link for a test SyNexusPro checkout.
 *   npm run square:test-checkout
 */

import { randomUUID } from "node:crypto";
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
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const env = { ...process.env, ...readEnvFile(join(root, ".env")) };
const useSandbox =
  ["1", "true", "yes"].includes(env.SQUARE_USE_SANDBOX?.trim().toLowerCase() ?? "") ||
  env.SQUARE_API_BASE?.includes("squareupsandbox.com");

const accessToken = (
  useSandbox ? env.SQUARE_SANDBOX_ACCESS_TOKEN : env.SQUARE_ACCESS_TOKEN
)?.trim();
const locationId = (
  useSandbox ? env.SQUARE_SANDBOX_LOCATION_ID || env.SQUARE_LOCATION_ID : env.SQUARE_LOCATION_ID
)?.trim();
const planVariationId =
  env.SQUARE_PLAN_VARIATION_ID_PRO?.trim() || env.SQUARE_ITEM_VARIATION_ID_PRO?.trim();
const apiBase = (
  env.SQUARE_API_BASE?.trim() ||
  (useSandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com")
).replace(/\/$/, "");
const appUrl = env.VITE_APP_URL?.trim() || "http://localhost:5173";

function looksLikeApplicationId(value) {
  return /^sandbox-sq0id[bp]-/i.test(value) || /^sq0id[bp]-/i.test(value);
}

function looksLikeWebhookId(value) {
  return /^wbhk_/i.test(value);
}

const missing = [];
if (!accessToken) {
  missing.push(useSandbox ? "SQUARE_SANDBOX_ACCESS_TOKEN" : "SQUARE_ACCESS_TOKEN");
}
if (!locationId) missing.push(useSandbox ? "SQUARE_SANDBOX_LOCATION_ID" : "SQUARE_LOCATION_ID");
if (!planVariationId) missing.push("SQUARE_PLAN_VARIATION_ID_PRO");

if (missing.length) {
  console.error("Missing required env vars:", missing.join(", "));
  if (!useSandbox) {
    console.error("Tip: for test payments add SQUARE_USE_SANDBOX=1 and sandbox credentials.");
  }
  process.exitCode = 1;
} else if (looksLikeApplicationId(accessToken)) {
  console.error("SQUARE_*_ACCESS_TOKEN looks like an Application ID, not an Access Token.");
  console.error("Copy the Sandbox Access Token from:");
  console.error("  Developer Console → your app → Sandbox → Credentials → Access Token");
  console.error("(Access tokens are long and usually start with EAAA...)");
  process.exitCode = 1;
} else if (looksLikeWebhookId(planVariationId)) {
  console.error("Plan ID looks like a webhook ID (wbhk_...). Use SKU SyNexusPro or catalog variation ID.");
  process.exitCode = 1;
} else {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Square-Version": "2026-05-20",
  };

  async function resolvePlanId(skuOrId) {
    if (looksLikeWebhookId(skuOrId)) return null;
    if (skuOrId.length >= 20 && /^[A-Z0-9]+$/i.test(skuOrId)) return skuOrId;

    async function searchSku(types) {
      const res = await fetch(`${apiBase}/v2/catalog/search`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          object_types: types,
          query: { exact_query: { attribute_name: "sku", attribute_value: skuOrId } },
        }),
      });
      const data = await res.json();
      return data.objects?.[0] ?? null;
    }

    const subVar = await searchSku(["SUBSCRIPTION_PLAN_VARIATION"]);
    if (subVar?.id) return subVar.id;

    const itemVar = await searchSku(["ITEM_VARIATION"]);
    if (itemVar?.id && itemVar.item_variation_data?.item_id) {
      const itemRes = await fetch(
        `${apiBase}/v2/catalog/object/${encodeURIComponent(itemVar.item_variation_data.item_id)}`,
        { headers },
      );
      const itemData = await itemRes.json();
      const itemName = itemData.object?.item_data?.name;
      if (itemName) {
        const plansRes = await fetch(`${apiBase}/v2/catalog/list?types=SUBSCRIPTION_PLAN`, { headers });
        const plansData = await plansRes.json();
        for (const plan of plansData.objects ?? []) {
          if (plan.subscription_plan_data?.name === itemName) {
            const variationId = plan.subscription_plan_data?.subscription_plan_variations?.[0]?.id;
            if (variationId) return variationId;
          }
        }
      }
    }

    return skuOrId;
  }

  const locationRes = await fetch(`${apiBase}/v2/locations`, { headers });
  if (!locationRes.ok) {
    const body = await locationRes.text();
    console.error(`Square token check failed (${locationRes.status}) on ${apiBase}`);
    console.error(body.slice(0, 400));
    console.error("\nUse a fresh Access Token (not Application ID) from Square Developer Console.");
    process.exitCode = 1;
  } else {
    const locationData = await locationRes.json();
    const names = (locationData.locations ?? [])
      .map((l) => `${l.name} (${l.id})`)
      .join(", ");
    console.log(`Square token OK (${useSandbox ? "sandbox" : "production"}). Locations: ${names || "(none)"}`);

    const resolvedPlanId = await resolvePlanId(planVariationId);
    console.log(`Plan input: ${planVariationId}`);
    console.log(`Resolved plan variation ID: ${resolvedPlanId}`);

    const redirectParams = new URLSearchParams({
      checkout: "success",
      plan: "PRO",
      userId: "square-test-user",
    });

    const linkRes = await fetch(`${apiBase}/v2/online-checkout/payment-links`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotency_key: randomUUID(),
        description: "SyNexusPro test checkout",
        quick_pay: {
          name: "SyNexusPro",
          price_money: { amount: 999, currency: "USD" },
          location_id: locationId,
        },
        checkout_options: {
          subscription_plan_id: resolvedPlanId,
          redirect_url: `${appUrl}/pulse?${redirectParams.toString()}`,
        },
        payment_note: "synexus-user:square-test-user",
      }),
    });

    const linkData = await linkRes.json();
    const url = linkData.payment_link?.url || linkData.payment_link?.long_url;

    if (!linkRes.ok || !url) {
      console.error(`Payment link failed (${linkRes.status})`);
      console.error(JSON.stringify(linkData, null, 2));
      process.exitCode = 1;
    } else {
      console.log("\nTest checkout URL (open in browser):");
      console.log(url);
      console.log("\nSandbox test card:");
      console.log("  4532 0123 4567 8901  |  any future expiry  |  any CVV  |  any ZIP");
    }
  }
}
