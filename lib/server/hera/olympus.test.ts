import assert from "node:assert/strict";
import test from "node:test";
import {
  collaboratorsFor,
  dispatchWorkforce,
  divisionIds,
  organizationReady,
  validateDivision,
  workforceRoster,
} from "./olympus.ts";
import { buildOwnerPushPayload } from "../owner/heraDirect.ts";

test("Olympus registers fifty roles in ten divisions under one Hera", () => {
  const roster = workforceRoster();
  assert.equal(roster.length, 50);
  assert.equal(divisionIds().length, 10);
  assert.equal(organizationReady(), true);
  assert.equal(new Set(roster.map((role) => role.id)).size, 50);
  assert.equal(roster.some((role) => role.agent === "Hera" || role.role === "Hera"), false);
  assert.ok(roster.some((role) => role.agent === "Alexus"));
  assert.ok(roster.some((role) => role.agent === "Aegis"));
  assert.ok(roster.some((role) => role.agent === "Hera Developer"));
  for (const id of divisionIds()) assert.equal(validateDivision(id).ok, true);
});

test("a paid assignment stops when the monthly limit is closed", () => {
  const blocked = dispatchWorkforce("implement a fix", { HERA_DEVELOPER_MONTHLY_USD: "0" }, 0);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.ran, false);
  assert.equal(blocked.paid, true);
  const local = dispatchWorkforce("check scam signals", {}, 0);
  assert.equal(local.ok, true);
  assert.equal(local.paid, false);
  assert.equal(local.ran, false);
  assert.equal(collaboratorsFor("check scam signals").includes("Aegis"), true);
});

test("shutdown and financial moves do not run themselves", () => {
  const halted = dispatchWorkforce("review the books", {}, 0, true);
  assert.equal(halted.ok, false);
  const finance = dispatchWorkforce("post a transaction", {}, 0);
  assert.equal(finance.ran, false);
  assert.equal(finance.approval, true);
});

test("a phone notification carries no private key", () => {
  const payload = JSON.parse(buildOwnerPushPayload("Hera", "Briefing ready.")) as Record<string, unknown>;
  assert.equal(payload.url, "/owner/hera");
  assert.equal(payload.title, "Hera");
  assert.equal("privateKey" in payload, false);
  assert.equal(JSON.stringify(payload).includes("VAPID"), false);
});
