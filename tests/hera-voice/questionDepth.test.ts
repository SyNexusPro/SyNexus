import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { needsDeeperReasoning } from "../../src/lib/hera/questionDepth";
import { latencyPercentile, summarizeLatency } from "../../src/lib/hera/latencyStats";

describe("needsDeeperReasoning", () => {
  it("keeps a short price question on the fast model", () => {
    assert.equal(needsDeeperReasoning("What is the price of SOL?", "token_lookup"), false);
    assert.equal(needsDeeperReasoning("hi"), false);
  });

  it("sends a troubleshooting question to the deeper model", () => {
    assert.equal(needsDeeperReasoning("Why doesn't the swap route work when liquidity is thin?"), true);
    assert.equal(needsDeeperReasoning("Walk me through the failure.", "explain"), true);
  });

  it("does not treat a live mover list as a reasoning problem", () => {
    assert.equal(needsDeeperReasoning("What is moving in the last five minutes and why are they up?", "market_movers"), false);
  });
});

describe("summarizeLatency", () => {
  it("reports the median and the 95th percentile", () => {
    const samples = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    const stats = summarizeLatency(samples);
    assert.equal(stats.count, 10);
    assert.equal(stats.p50, latencyPercentile(samples, 50));
    assert.equal(stats.p50, 500);
    assert.equal(stats.p95, 1000);
  });

  it("returns nulls when nothing has been recorded", () => {
    assert.deepEqual(summarizeLatency([]), { count: 0, p50: null, p95: null });
  });
});
