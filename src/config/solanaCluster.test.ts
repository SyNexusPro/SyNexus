import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { resolveSolanaCluster } from "./solanaCluster.ts";

describe("solana cluster", () => {
  test("an unset cluster stays on mainnet", () => {
    const resolved = resolveSolanaCluster(undefined, undefined);
    assert.equal(resolved.cluster, "mainnet-beta");
    assert.equal(resolved.rpc, "https://api.mainnet-beta.solana.com");
  });

  test("devnet is selected only when the testing flag is set", () => {
    const resolved = resolveSolanaCluster("devnet");
    assert.equal(resolved.cluster, "devnet");
    assert.equal(resolved.rpc, "https://api.devnet.solana.com");
  });

  test("an explicit rpc is kept", () => {
    const resolved = resolveSolanaCluster("devnet", "https://rpc.example/devnet");
    assert.equal(resolved.rpc, "https://rpc.example/devnet");
  });
});
