/**
 * Smoke test: /api/checkout stays a non-redirect stub (Paddle uses client overlay).
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
  if (res.status !== 503) {
    throw new Error(`Expected 503 from checkout stub (${res.status}): ${JSON.stringify(body)}`);
  }
  if (!body?.error || typeof body.error !== "string") {
    throw new Error(`Expected error message: ${JSON.stringify(body)}`);
  }
  console.log("OK — checkout stub returns 503:", body.error);
}

main().catch((err) => {
  console.error("FAIL —", err.message ?? err);
  process.exit(1);
});
