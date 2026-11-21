import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ingestCryptoLearning } from "./cryptoLearning.js";

describe("ingestCryptoLearning", () => {
  it("stores YouTube titles and news headlines into memory", async () => {
    const stored: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("youtube.com/feeds")) {
        return new Response(
          `<?xml version="1.0"?><feed><entry><title>How to read crypto charts safely</title></entry></feed>`,
          { status: 200 },
        );
      }
      if (url.includes("cryptocompare.com")) {
        return new Response(
          JSON.stringify({
            Data: [{ title: "Bitcoin holds support after volatility", body: "Traders watched liquidity.", source_info: { name: "TestWire" } }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("embeddings")) {
        return new Response(JSON.stringify({ data: [{ embedding: Array.from({ length: 8 }, (_, i) => i / 8) }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("missing", { status: 404 });
    };

    // rememberText needs Supabase. Without it every write is skipped — assert the fetch path still runs.
    const result = await ingestCryptoLearning(
      { OPENAI_API_KEY: "sk-test", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "" },
      fetchImpl,
    );
    assert.equal(result.youtubeStored, 0);
    assert.equal(result.newsStored, 0);
    assert.ok(result.skipped >= 1);
    assert.equal(stored.length, 0);
  });
});
