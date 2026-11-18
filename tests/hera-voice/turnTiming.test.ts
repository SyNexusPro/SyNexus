import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lipEnvelope, turnLatencyMs } from "../../src/lib/hera/turnTiming";

describe("lipEnvelope", () => {
  it("opens faster than the previous 0.28 attack", () => {
    let next = 0;
    let previous = 0;
    for (let i = 0; i < 3; i += 1) next = lipEnvelope(next, 1);
    for (let i = 0; i < 3; i += 1) previous = previous + (1 - previous) * 0.28;
    assert.ok(next > previous);
    assert.ok(next > 0.85);
  });
});

describe("turnLatencyMs", () => {
  it("reports the gap from the end of speech to the first audio", () => {
    assert.equal(turnLatencyMs(1_000, 1_420), 420);
    assert.equal(turnLatencyMs(1_000, 900), null);
  });
});
