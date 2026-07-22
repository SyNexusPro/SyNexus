/**
 * Smoke test: local /api/checkout returns a Square payment link.
 * Run: node scripts/smoke-checkout-api.mjs
 */
const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:5173";

async function main() {
  const res = await fetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan: "PRO", userId: "smoke-checkout-user" }),
  });
  const body = await res.json();
  if (res.status !== 200 || !body.url || !String(body.url).includes("square.link")) {
    throw new Error(`Checkout API failed (${res.status}): ${JSON.stringify(body)}`);
  }
  console.log("OK — Checkout API returned Square link.");
}

main().catch((err) => {
  console.error("FAIL —", err.message ?? err);
  process.exit(1);
});
