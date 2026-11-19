import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  discoverNewTokens,
  heliusConfigured,
  heliusHttpEndpoint,
  probeHelius,
  recentSignatures,
  redactHelius,
  trackWallet,
} from "./client.js";

const KEY = "fixture-helius-key";
const env = { HELIUS_API_KEY: KEY };
const OWNER = "So11111111111111111111111111111111111111112";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("helius client", () => {
  test("stays unconfigured without a key and never builds a url", () => {
    assert.equal(heliusConfigured({}), false);
    assert.equal(heliusHttpEndpoint({}), null);
    assert.equal(heliusHttpEndpoint({ HELIUS_API_KEY: "  " }), null);
  });

  test("redacts the key from errors", () => {
    const leaked = `fetch failed https://mainnet.helius-rpc.com/?api-key=${KEY}`;
    const clean = redactHelius(leaked, env);
    assert.equal(clean.includes(KEY), false);
    assert.equal(clean.includes("api-key=redacted"), true);
  });

  test("a health probe reports the slot and hides the key", async () => {
    const calls: string[] = [];
    const reading = await probeHelius(env, async (input, init) => {
      const url = String(input);
      calls.push(url);
      assert.equal(new URL(url).hostname, "mainnet.helius-rpc.com");
      const body = JSON.parse(String(init?.body));
      if (body.method === "getHealth") return json({ result: "ok" });
      if (body.method === "getSlot") return json({ result: 321 });
      return json({ error: { message: "unexpected" } }, 500);
    });
    assert.deepEqual(reading, { configured: true, ok: true, slot: 321, reason: "ready" });
    assert.equal(JSON.stringify(reading).includes(KEY), false);
    assert.equal(calls.length, 2);
  });

  test("transaction monitoring keeps signatures only", async () => {
    const rows = await recentSignatures(env, OWNER, async () => json({
      result: [{ signature: "sig1", slot: 9, err: null, blockTime: 10 }, { signature: "", slot: 1 }],
    }));
    assert.deepEqual(rows, [{ signature: "sig1", slot: 9, failed: false, blockTime: 10 }]);
  });

  test("wallet tracking returns balances without account blobs", async () => {
    const wallet = await trackWallet(env, OWNER, async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      if (body.method === "getBalance") return json({ result: { value: 50 } });
      return json({
        result: {
          value: [{
            account: {
              data: { parsed: { info: { mint: OWNER, tokenAmount: { amount: "5", decimals: 6 } } } },
            },
          }],
        },
      });
    });
    assert.equal(wallet.ok, true);
    assert.equal(wallet.lamports, 50);
    assert.equal(wallet.tokens.length, 2);
    assert.equal(JSON.stringify(wallet).includes("account"), false);
  });

  test("new-token discovery reads mints and ignores a failed search", async () => {
    const found = await discoverNewTokens(env, 4, async () => json({
      result: { items: [{ id: OWNER, content: { metadata: { symbol: "SOL", name: "Wrapped SOL" } } }, { id: "nope" }] },
    }));
    assert.deepEqual(found, [{ mint: OWNER, symbol: "SOL", name: "Wrapped SOL" }]);
    const empty = await discoverNewTokens(env, 4, async () => json({ error: { message: `bad ${KEY}` } }, 500));
    assert.deepEqual(empty, []);
  });
});
