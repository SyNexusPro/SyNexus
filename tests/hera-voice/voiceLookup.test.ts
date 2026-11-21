import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { voiceLookupForTranscript } from "../../src/lib/hera/voiceLookup";

describe("voiceLookupForTranscript", () => {
  it("leaves an ordinary question on the conversation", () => {
    assert.equal(voiceLookupForTranscript("hey, how was your morning"), null);
    assert.equal(voiceLookupForTranscript("explain how a limit order works"), null);
  });

  it("uses a tool only when the question needs one", () => {
    assert.equal(voiceLookupForTranscript("what is the price of SOL")?.tool, "venue_desk");
    assert.equal(voiceLookupForTranscript("what did you tell me last time we talked")?.tool, "memory_search");
    assert.equal(voiceLookupForTranscript("any Alexus paper lessons")?.tool, "alexus_learning");
    assert.equal(voiceLookupForTranscript("what did you learn from that youtube crypto video")?.tool, "memory_search");
    assert.equal(voiceLookupForTranscript("what's going on with solana")?.tool, "venue_desk");
    const mint = "So11111111111111111111111111111111111111112";
    assert.equal(voiceLookupForTranscript(`compare the jupiter route for ${mint}`)?.tool, "route_compare");
  });
});