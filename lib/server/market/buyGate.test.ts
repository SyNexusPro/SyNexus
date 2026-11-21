import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { assessSwap, isExitMint, screenFromGoPlus } from "./buyGate.js";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const at = "2026-11-19T12:00:00.000Z";

function goplus(row: Record<string, unknown> | null, code: unknown = 1) {
  return { code, result: row ? { [MINT]: row } : {} };
}

describe("buy gate", () => {
  test("exits to SOL or USDC stay open without calling a screen", async () => {
    assert.equal(isExitMint(SOL), true);
    let called = false;
    const screen = await assessSwap(USDC, async () => {
      called = true;
      return new Response("no");
    });
    assert.equal(called, false);
    assert.equal(screen.kind, "exit");
    assert.equal(screen.allowed, true);
    assert.equal(screen.guarantee, false);
  });

  test("a listed token with no block flags can be bought and is not called safe", () => {
    const screen = screenFromGoPlus(MINT, goplus({
      trusted_token: 0,
      non_transferable: "0",
      freezable: { status: "0" },
      closable: { status: "0" },
      transfer_hook: [],
    }), at);
    assert.equal(screen.allowed, true);
    assert.equal(screen.guarantee, false);
    assert.equal(screen.note.includes("does not guarantee"), true);
  });

  test("freeze authority on an untrusted token blocks the buy", () => {
    const screen = screenFromGoPlus(MINT, goplus({
      trusted_token: 0,
      non_transferable: "0",
      freezable: { status: "1" },
      closable: { status: "0" },
      transfer_hook: [],
    }), at);
    assert.equal(screen.allowed, false);
    assert.deepEqual(screen.reasons, ["freeze_authority"]);
  });

  test("a trusted token keeps a freeze flag from becoming a buy block", () => {
    const screen = screenFromGoPlus(MINT, goplus({
      trusted_token: 1,
      non_transferable: "0",
      freezable: { status: "1" },
      closable: { status: "0" },
      transfer_hook: [],
    }), at);
    assert.equal(screen.allowed, true);
  });

  test("a missing record or a dead screen refuses the buy", () => {
    const missing = screenFromGoPlus(MINT, goplus(null), at);
    const dead = screenFromGoPlus(MINT, { code: 0 }, at);
    assert.equal(missing.allowed, false);
    assert.equal(missing.reasons[0], "no_current_record");
    assert.equal(dead.allowed, false);
    assert.equal(dead.reasons[0], "screening_unavailable");
  });
});
