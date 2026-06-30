#!/usr/bin/env node
/** Pull Supabase treasury entries into local pot-state for VPS reporting. */
import { loadMarketingEnv } from "./loadEnv.js";
import { readPotState, printTreasuryReport } from "./treasuryPot.js";

loadMarketingEnv();

async function main() {
  const state = await readPotState();
  console.log(`Synced ${state.entries?.length ?? 0} treasury entries (local + Supabase).`);
  await printTreasuryReport();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
