import assert from "node:assert/strict";
import test from "node:test";
import { buildConnectedWalletBrief } from "./connectedWalletBrief.ts";

test("wallet brief stays read-only and truncates the public address", () => {
  const brief = buildConnectedWalletBrief(
    {
      address: "So11111111111111111111111111111111111111112",
      kind: "Phantom",
      sol: 1.25,
      tokens: [{ mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC", name: "USDC", uiAmount: 12.5, decimals: 6, raw: "12500000" }],
    },
    "Phantom",
  );
  assert.ok(brief);
  assert.match(brief!, /So11…1112/);
  assert.match(brief!, /read-only/i);
  assert.match(brief!, /Never claim a token is safe/i);
  assert.doesNotMatch(brief!, /private key|seed|mnemonic/i);
});

test("missing snapshot returns null", () => {
  assert.equal(buildConnectedWalletBrief(null, null), null);
});
