import assert from "node:assert/strict";
import test from "node:test";
import {
  complimentaryTrialActive,
  developerAccessAllowed,
  entitlementGrantsAccess,
  membershipFeeBps,
  pickMembershipTier,
  socialNetworkAllowed,
  webhookAuthorized,
} from "./policy.js";
import { readRevenueCatAccess } from "./revenuecat.js";
import { signTradeQuote, tradeQuoteMatches } from "./quoteToken.js";

const now = Date.parse("2026-11-15T00:00:00.000Z");

test("pantheon includes social and charges no SyNexus fee", () => {
  const tier = pickMembershipTier({ owner: false, pantheon: true, nextLevel: true, trial: false });
  assert.equal(tier, "pantheon");
  assert.equal(socialNetworkAllowed(tier, false), true);
  assert.equal(membershipFeeBps(tier, false), 0);
  assert.equal(developerAccessAllowed(false), false);
});

test("next level keeps a fee and does not open the social network", () => {
  const tier = pickMembershipTier({ owner: false, pantheon: false, nextLevel: true, trial: false });
  assert.equal(tier, "next_level");
  assert.equal(socialNetworkAllowed(tier, false), false);
  assert.equal(membershipFeeBps(tier, false), 5);
});

test("the complimentary trial is next level and does not open owner tools", () => {
  const started = new Date(now - 2 * 86_400_000).toISOString();
  assert.equal(complimentaryTrialActive(started, true, now), true);
  const tier = pickMembershipTier({ owner: false, pantheon: false, nextLevel: false, trial: true });
  assert.equal(tier, "next_level");
  assert.equal(developerAccessAllowed(false), false);
  assert.equal(complimentaryTrialActive(new Date(now - 31 * 86_400_000).toISOString(), true, now), false);
});

test("owner access stays separate from a pantheon purchase", () => {
  assert.equal(developerAccessAllowed(true), true);
  assert.equal(membershipFeeBps("pantheon", true), 0);
  assert.equal(socialNetworkAllowed("free", true), true);
});

test("an expired store entitlement does not grant access", () => {
  assert.equal(entitlementGrantsAccess({ present: true, expiresDate: "2026-11-01T00:00:00.000Z" }, now), false);
  assert.equal(entitlementGrantsAccess({ present: true, expiresDate: "2026-12-01T00:00:00.000Z" }, now), true);
  const access = readRevenueCatAccess({
    subscriber: {
      entitlements: {
        next_level: { expires_date: "2026-11-01T00:00:00.000Z", product_identifier: "next_level_monthly" },
        pantheon: { expires_date: "2026-12-01T00:00:00.000Z", product_identifier: "the_pantheon_monthly", unsubscribe_detected_at: "2026-11-10T00:00:00.000Z" },
      },
    },
  }, now);
  assert.equal(access.pantheon, true);
  assert.equal(access.unsubscribeDetectedAt, "2026-11-10T00:00:00.000Z");
});

test("webhook authorization fails closed", () => {
  assert.equal(webhookAuthorized(undefined, ""), false);
  assert.equal(webhookAuthorized("Bearer secret", ""), false);
  assert.equal(webhookAuthorized("nope", "secret"), false);
  assert.equal(webhookAuthorized("Bearer secret", "secret"), true);
});

test("a client cannot swap a quote signed for a different fee", () => {
  const env = { SYNEXUS_OWNER_SIGNING_KEY: "test-signing-key" };
  const quote = { inputMint: "a", outputMint: "b", inAmount: "1", outAmount: "2" };
  const payload = JSON.stringify({ ...quote, feeBps: 10 });
  const token = signTradeQuote(payload, env);
  assert.ok(token);
  assert.equal(tradeQuoteMatches(payload, token!, env), true);
  assert.equal(tradeQuoteMatches(JSON.stringify({ ...quote, feeBps: 0 }), token!, env), false);
});
