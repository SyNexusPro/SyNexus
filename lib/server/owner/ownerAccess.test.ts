import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { handleOwnerUnlock } from "../../../api/_routes/ownerUnlock.js";
import { verifyOwnerGrant } from "../ownerGrant.js";
import { composeOwnerBrief } from "./briefFormat.js";
import { ownerFromAccessToken, ownerFromPassword } from "../ownerSession.js";

const env = {
  SYNEXUS_OWNER_EMAIL: "owner@synexus.pro",
  SYNEXUS_OWNER_SIGNING_KEY: "test-signing-key",
};

describe("owner session", () => {
  test("a different email is rejected before any password check can succeed", async () => {
    const result = await ownerFromPassword("someone@example.com", "not-the-owner", {
      ...env,
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "public-anon",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 401);
  });

  test("missing Supabase configuration does not grant access", async () => {
    const result = await ownerFromAccessToken("header.payload.sig", env);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 503);
  });
});

describe("owner unlock", () => {
  test("no session is rejected", async () => {
    const result = await handleOwnerUnlock({}, env, null, {
      verifyAccessToken: async () => ({ ok: false, status: 401, error: "no" }),
      verifyPassword: async () => ({ ok: false, status: 401, error: "no" }),
    });
    assert.equal(result.statusCode, 400);
    assert.equal(result.body.ok, undefined);
  });

  test("a non-owner session is rejected", async () => {
    const result = await handleOwnerUnlock({}, env, "Bearer not-owner", {
      verifyAccessToken: async () => ({ ok: false, status: 401, error: "This account is not the SyNexus owner." }),
      verifyPassword: async () => ({ ok: false, status: 401, error: "no" }),
    });
    assert.equal(result.statusCode, 401);
    assert.equal(result.body.grant, undefined);
  });

  test("a failed verification does not unlock", async () => {
    const result = await handleOwnerUnlock({}, env, "Bearer token", {
      verifyAccessToken: async () => ({ ok: false, status: 503, error: "Owner access is not configured on this server." }),
      verifyPassword: async () => ({ ok: false, status: 401, error: "no" }),
    });
    assert.equal(result.statusCode, 503);
    assert.equal(result.body.ok, undefined);
  });

  test("the owner session receives a signed grant", async () => {
    const result = await handleOwnerUnlock({}, env, "Bearer owner-token", {
      verifyAccessToken: async () => ({ ok: true, email: "owner@synexus.pro", userId: "user-1" }),
      verifyPassword: async () => ({ ok: false, status: 401, error: "no" }),
    });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.ok, true);
    assert.equal(typeof result.body.grant, "string");
    assert.equal(verifyOwnerGrant(result.body.grant!, env), "owner@synexus.pro");
  });
});

describe("owner briefing", () => {
  test("missing figures stay unavailable instead of becoming zero", () => {
    const brief = composeOwnerBrief({
      asOf: "2026-11-13T00:00:00.000Z",
      databaseReachable: false,
      swapsConfirmed: null,
      swapsFailed: null,
      swapsPending: null,
      signups: null,
      accounts: null,
      newAccounts: null,
      members: null,
      activeSubscriptions: null,
      recordedRevenueUsd: null,
      securityEvents: null,
      criticalSecurityEvents: null,
      dailyDigestRows: null,
    });
    assert.match(brief.detail, /Confirmed swaps, last 24 hours: Data unavailable/);
    assert.doesNotMatch(brief.detail, /Confirmed swaps, last 24 hours: 0/);
    assert.match(brief.detail, /Recorded payment ledger: Data unavailable/);
    assert.match(brief.detail, /SyNexus fee dollars: Data unavailable/);
    assert.match(brief.detail, /Trading profit: Data unavailable/);
    assert.match(brief.spoken, /Data unavailable/);
  });

  test("a real zero from the ledger is reported as zero", () => {
    const brief = composeOwnerBrief({
      asOf: "2026-11-13T00:00:00.000Z",
      databaseReachable: true,
      swapsConfirmed: 2,
      swapsFailed: 1,
      swapsPending: 0,
      signups: 3,
      accounts: 13,
      newAccounts: 1,
      members: 4,
      activeSubscriptions: 0,
      recordedRevenueUsd: 0,
      securityEvents: 5,
      criticalSecurityEvents: 0,
      dailyDigestRows: 0,
    });
    assert.match(brief.detail, /Accounts: 13/);
    assert.match(brief.detail, /New accounts, last 24 hours: 1/);
    assert.match(brief.detail, /Confirmed swaps, last 24 hours: 2/);
    assert.match(brief.detail, /Recorded payment ledger, last 24 hours: \$0\.00/);
    assert.match(brief.detail, /Profiles marked subscription active: 0/);
    assert.match(brief.detail, /no digest row was written/);
    assert.match(brief.detail, /App store subscription charges: Data unavailable/);
  });
});
