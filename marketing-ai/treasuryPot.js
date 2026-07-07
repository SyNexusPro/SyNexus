import {
  ensureGrowthPhase,
  readPotState,
  aggregateBuckets,
  logRevenue as coreLogRevenue,
  loadPolicy,
} from "../lib/treasury/treasuryCore.mjs";

export { loadPolicy, ensureGrowthPhase, readPotState };

/** Log revenue — 100% allocated to reinvest buckets (you don't touch it). */
export async function logRevenue(opts) {
  return coreLogRevenue(opts);
}

export async function writePotState(state) {
  const { writeLocalPotState } = await import("../lib/treasury/treasuryCore.mjs");
  return writeLocalPotState(state);
}

export async function readPotStateLegacy() {
  return readPotState();
}

export async function printTreasuryReport() {
  const { policy } = await ensureGrowthPhase();
  const state = await readPotState();

  const byBucket = await aggregateBuckets(state, policy);

  const daysLeft = state.reinvestUntil
    ? Math.max(0, Math.ceil((new Date(state.reinvestUntil) - Date.now()) / 86_400_000))
    : policy.reinvestMonths * 30;

  const supabaseNote = state.entries?.some((e) => e.origin === "supabase")
    ? " (includes Stripe auto-log from Supabase)"
    : "";

  console.log("\n💰 SYNEXUS TREASURY POT — GROWTH PHASE");
  console.log("═".repeat(52));
  console.log(`Policy: ${policy.policy}`);
  console.log(`Started: ${state.startedAt?.slice(0, 10) ?? "today"}`);
  console.log(`Reinvest-only until: ${state.reinvestUntil?.slice(0, 10) ?? "—"} (${daysLeft} days left)`);
  console.log(`Total logged: $${state.totalLoggedUsd.toFixed(2)}${supabaseNote}`);
  console.log("\nAllocated (do not withdraw):");
  for (const bucket of Object.values(byBucket)) {
    console.log(`  ${bucket.label.padEnd(32)} $${bucket.totalUsd.toFixed(2)} (${bucket.pct}%)`);
  }
  console.log("\n6-month targets:");
  for (const [key, val] of Object.entries(policy.sixMonthTargets)) {
    console.log(`  ${key}: ${val}`);
  }
  console.log("\nStripe Pro payments auto-log via webhook → Supabase treasury_revenue");
  console.log("Manual: npm run treasury:log -- --source=pro_subs --amount=9.99");
  console.log("");
}
