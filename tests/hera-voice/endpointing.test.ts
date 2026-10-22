import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HERA_DEFAULT_PATIENCE,
  calibrateNoise,
  endpointDelayMs,
  liveTurnQuietMs,
  normalizeHeraPatience,
  recorderSilenceMs,
  soundsFinished,
  soundsUnfinished,
} from "../../src/lib/hera/endpointing";

describe("soundsUnfinished", () => {
  it("treats dangling connectors and fillers as unfinished", () => {
    for (const text of [
      "I want to look at bitcoin and",
      "what is the price of",
      "so um",
      "tell me about the",
      "it's good but",
      "okay so,",
      "let me think...",
    ]) {
      assert.equal(soundsUnfinished(text), true, text);
    }
  });

  it("treats complete thoughts as finished", () => {
    for (const text of ["What is the price of Bitcoin?", "Show me SYN.", "yes", "tell me about solana"]) {
      assert.equal(soundsUnfinished(text), false, text);
    }
  });

  it("ignores empty input", () => {
    assert.equal(soundsUnfinished(""), false);
    assert.equal(soundsUnfinished("   "), false);
  });
});

describe("soundsFinished", () => {
  it("detects sentence-final punctuation", () => {
    assert.equal(soundsFinished("How is the market?"), true);
    assert.equal(soundsFinished("Thanks."), true);
    assert.equal(soundsFinished("How is the market"), false);
  });
});

describe("endpointDelayMs", () => {
  it("waits longer for an unfinished sentence than a finished one", () => {
    for (const patience of ["quick", "natural", "patient"] as const) {
      const unfinished = endpointDelayMs("I was wondering about the", patience);
      const finished = endpointDelayMs("What is the price of bitcoin?", patience);
      assert.ok(unfinished > finished, `${patience}: ${unfinished} should exceed ${finished}`);
    }
  });

  it("gets more patient from quick to patient", () => {
    const text = "tell me about solana";
    const quick = endpointDelayMs(text, "quick");
    const natural = endpointDelayMs(text, "natural");
    const patient = endpointDelayMs(text, "patient");
    assert.ok(quick < natural && natural < patient);
  });

  it("never commits sooner than the old fixed 1.4s pause in the default profile for unfinished speech", () => {
    assert.ok(endpointDelayMs("and then", HERA_DEFAULT_PATIENCE) > 1400);
  });

  it("gives long thoughts a little more grace, capped", () => {
    const short = endpointDelayMs("tell me about solana", "natural");
    const long = endpointDelayMs(Array.from({ length: 60 }, () => "word").join(" "), "natural");
    assert.ok(long > short);
    assert.ok(long - short <= 800);
  });
});

describe("recorderSilenceMs", () => {
  it("grows with how long the user has spoken, with a cap", () => {
    const brief = recorderSilenceMs("natural", 1000);
    const long = recorderSilenceMs("natural", 30_000);
    assert.ok(long > brief);
    assert.ok(long - brief <= 1200);
  });

  it("is more patient than the previous fixed 1.1s", () => {
    for (const patience of ["quick", "natural", "patient"] as const) {
      assert.ok(recorderSilenceMs(patience, 0) > 1100);
    }
  });
});

describe("liveTurnQuietMs", () => {
  it("is slower than the previous fixed 900ms", () => {
    assert.ok(liveTurnQuietMs("natural") > 900);
    assert.ok(liveTurnQuietMs("quick") >= 900);
  });
});

describe("normalizeHeraPatience", () => {
  it("accepts only known values", () => {
    assert.equal(normalizeHeraPatience(" Patient "), "patient");
    assert.equal(normalizeHeraPatience("quick"), "quick");
    assert.equal(normalizeHeraPatience("slow"), null);
    assert.equal(normalizeHeraPatience(null), null);
    assert.equal(normalizeHeraPatience(undefined), null);
  });
});

describe("calibrateNoise", () => {
  it("keeps a floor on speech sensitivity in a silent room", () => {
    const { speechLevel, silenceLevel } = calibrateNoise([0, 0, 0, 0.001]);
    assert.ok(speechLevel >= 0.055);
    assert.ok(silenceLevel < speechLevel);
  });

  it("raises thresholds in a noisy room", () => {
    const quiet = calibrateNoise([0.01, 0.01, 0.01, 0.01]);
    const noisy = calibrateNoise([0.06, 0.06, 0.07, 0.06]);
    assert.ok(noisy.speechLevel > quiet.speechLevel);
    assert.ok(noisy.silenceLevel > quiet.silenceLevel);
  });

  it("does not mistake the user's own voice for the room if they start talking immediately", () => {
    const loudStart = [0.3, 0.32, 0.31, 0.3, 0.02, 0.02, 0.02, 0.02];
    const { speechLevel } = calibrateNoise(loudStart);
    assert.ok(speechLevel <= 0.16);
  });

  it("handles missing or invalid samples", () => {
    const empty = calibrateNoise([]);
    assert.ok(empty.silenceLevel < empty.speechLevel);
    const junk = calibrateNoise([Number.NaN, -1, Number.POSITIVE_INFINITY]);
    assert.ok(junk.silenceLevel < junk.speechLevel);
  });
});
