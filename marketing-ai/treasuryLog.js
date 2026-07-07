#!/usr/bin/env node
import { loadMarketingEnv } from "./loadEnv.js";
import { logRevenue, printTreasuryReport } from "./treasuryPot.js";

loadMarketingEnv();

const args = process.argv.slice(2);

function arg(name) {
  const eq = args.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.split("=")[1];
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

async function main() {
  if (args.includes("--help")) {
    console.log(`Log revenue into the reinvest-only treasury pot.

  npm run treasury:status
  npm run treasury:log -- --source=pro_subs --amount=9.99 --note="1 sub"

Sources: pro_subs · trading_fees · affiliate · other
`);
    return;
  }

  if (args.includes("--status") || args.length === 0) {
    await printTreasuryReport();
    return;
  }

  const source = arg("source") || "other";
  const amount = Number(arg("amount"));
  const note = arg("note") || "";

  if (!Number.isFinite(amount) || amount <= 0) {
    console.error("Provide --amount= with a positive number");
    process.exit(1);
  }

  const { entry, policy } = await logRevenue({ source, amountUsd: amount, note });
  console.log(`\n✓ Logged $${amount.toFixed(2)} from ${source}`);
  console.log("Allocated (do not withdraw):");
  for (const slice of entry.allocated) {
    const row = policy.allocation.find((r) => r.id === slice.id);
    console.log(`  ${row?.label ?? slice.id}: $${slice.amountUsd.toFixed(2)}`);
  }
  console.log("");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
