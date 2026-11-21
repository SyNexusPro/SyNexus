import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextSpeechNod, speechPose } from "../../src/lib/hera/speechMotion";

describe("speech movement", () => {
  it("nods on a syllable and then settles", () => {
    const hit = nextSpeechNod(0, 0.8, 0.1);
    assert.ok(hit > 0.4);
    const rest = nextSpeechNod(hit, 0.8, 0.8);
    assert.ok(rest < hit);
  });

  it("keeps the speaking pose small", () => {
    const pose = speechPose(1.2, 1, 1);
    assert.ok(Math.abs(pose.x) < 4);
    assert.ok(Math.abs(pose.y) < 5);
    assert.ok(pose.rx > 0 && pose.rx < 1.4);
    assert.ok(Math.abs(pose.ry) < 0.6);
    assert.ok(Math.abs(pose.rz) < 0.5);
  });
});
