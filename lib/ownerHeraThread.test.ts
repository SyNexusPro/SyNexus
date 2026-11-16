import assert from "node:assert/strict";
import test from "node:test";
import { pickNewerOwnerHeraTurns, sanitizeOwnerHeraTurns } from "./ownerHeraThread.ts";

test("owner conversation memory keeps only real turns", () => {
  const turns = sanitizeOwnerHeraTurns([
    { id: "1", role: "user", text: "  Good morning  ", at: 10 },
    { id: "2", role: "guest", text: "no", at: 11 },
    { id: "", role: "oracle", text: "missing id", at: 12 },
    { id: "3", role: "oracle", text: "Briefing ready.", at: 20, responseId: "r1" },
  ]);
  assert.equal(turns.length, 2);
  assert.equal(turns[0]?.text, "Good morning");
  assert.equal(turns[1]?.responseId, "r1");
});

test("the newer phone or desktop thread wins", () => {
  const local = [{ id: "a", role: "user" as const, text: "desktop", at: 50 }];
  const remote = [{ id: "b", role: "oracle" as const, text: "phone", at: 40 }];
  assert.equal(pickNewerOwnerHeraTurns(local, remote)[0]?.text, "desktop");
  assert.equal(pickNewerOwnerHeraTurns(local, [{ ...remote[0], at: 60 }])[0]?.text, "phone");
});
