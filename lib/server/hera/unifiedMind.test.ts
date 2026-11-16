import assert from "node:assert/strict";
import test from "node:test";
import {
  canApproveSharedLesson,
  containsPrivateDetail,
  formatHeraMind,
  personalNoteFromUtterance,
  proposeSharedLesson,
} from "./unifiedMind.ts";

test("a shared lesson cannot carry a private detail", () => {
  assert.equal(proposeSharedLesson("When a feed is missing, say it did not return the coin.").ok, true);
  assert.equal(proposeSharedLesson("Email ada@example.com next time.").ok, false);
  assert.equal(proposeSharedLesson("My name is Ada and I like short answers.").ok, false);
  assert.equal(containsPrivateDetail("wallet So11111111111111111111111111111111111111112"), true);
});

test("personal memory is opt-in and shared lessons stay general", () => {
  assert.equal(personalNoteFromUtterance("I prefer short answers in the morning."), "I prefer short answers in the morning.");
  assert.equal(personalNoteFromUtterance("My email is ada@example.com"), null);
  const text = formatHeraMind({
    personalConsent: false,
    personalNotes: ["I prefer short answers."],
    sharedLessons: ["Say when a live number was not returned."],
    memoryAvailable: true,
  });
  assert.match(text, /has not allowed personal memory/);
  assert.doesNotMatch(text, /I prefer short answers/);
  assert.match(text, /Say when a live number was not returned/);
});

test("only the owner can approve a lesson into Hera's shared mind", () => {
  assert.equal(canApproveSharedLesson(false), false);
  assert.equal(canApproveSharedLesson(true), true);
});
