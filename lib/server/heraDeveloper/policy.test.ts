import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { cloudInvestigationGate } from "./cloudAgent.js";
import {
  diffIsSensitive,
  evaluateDecision,
  pathIsProtected,
  spendAllowed,
} from "./policy.js";
import { buildDailyReview } from "./review.js";
import { spokenDeveloperReport, type DeveloperProposal } from "./store.js";

describe("Hera Developer policy", () => {
  test("a docs heartbeat is not a protected path", () => {
    assert.equal(pathIsProtected("docs/hera-developer/heartbeat.md"), false);
    assert.equal(diffIsSensitive(["docs/hera-developer/heartbeat.md"]), false);
  });

  test("payment, wallet, auth, and database paths are protected", () => {
    assert.equal(diffIsSensitive(["api/_routes/checkout.ts"]), true);
    assert.equal(diffIsSensitive(["src/lib/synWallet/vault.ts"]), true);
    assert.equal(diffIsSensitive(["api/_routes/ownerUnlock.ts"]), true);
    assert.equal(diffIsSensitive(["supabase/hera_developer.sql"]), true);
  });

  test("approval is bound to the tested revision and never deploys", () => {
    const mismatch = evaluateDecision("approve", "abc123", "def456");
    assert.equal(mismatch.ok, false);
    if (!mismatch.ok) assert.equal(mismatch.http, 409);

    const deploy = evaluateDecision("deploy", "abc123", "abc123");
    assert.equal(deploy.ok, false);
    if (!deploy.ok) assert.equal(deploy.http, 403);

    const approved = evaluateDecision("approve", "abc123", "abc123");
    assert.equal(approved.ok, true);
    if (approved.ok) {
      assert.equal(approved.status, "approved");
      assert.equal(approved.deploy, false);
    }
  });

  test("a zero budget blocks paid cloud runs", () => {
    assert.equal(spendAllowed(0, 0, 1).ok, false);
    assert.equal(spendAllowed(5, 4.5, 1).ok, false);
    assert.equal(spendAllowed(5, 4, 1).ok, true);
    const gate = cloudInvestigationGate({}, 0);
    assert.equal(gate.ok, false);
  });

  test("the daily review changes no code", () => {
    const review = buildDailyReview({ day: "2026-11-13", cloudReason: "CURSOR_API_KEY is not set on the server.", openCount: 1 });
    assert.equal(review.ready, false);
    assert.match(review.changeSummary, /No code was written/);
    assert.equal(review.testedSha, "review-only-2026-11-13");
  });

  test("the spoken report does not claim a deploy", () => {
    const proposal: DeveloperProposal = {
      id: "1",
      title: "Heartbeat",
      discovery: "A docs note is waiting.",
      changeSummary: "Added a markdown file.",
      why: "To test approval.",
      testsPassed: "Policy tests passed.",
      testsFailed: "",
      benefits: "The approval path can be checked.",
      risks: "None for production.",
      ready: false,
      status: "proposed",
      testedSha: "abc",
      branchName: "hera/developer-heartbeat",
      sensitive: false,
      rollback: "Delete the branch.",
      createdAt: "2026-11-13T00:00:00.000Z",
    };
    const spoken = spokenDeveloperReport([proposal]);
    assert.match(spoken, /Nothing has been merged or deployed/);
    assert.match(spoken, /Heartbeat/);
  });
});
