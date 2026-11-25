import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import test from "node:test";
import postgres from "postgres";
import { handleRevenueCatWebhook } from "../../../api/_routes/revenuecat/webhook.ts";
import { createMemoryWebhookLedger, readMembershipRecord, startComplimentaryTrial } from "./store.ts";

function response() {
  const sent: { status: number; body: string } = { status: 0, body: "" };
  const res = {
    statusCode: 0,
    setHeader() {},
    end(body: string) {
      sent.status = this.statusCode;
      sent.body = body;
    },
  };
  return { res: res as unknown as ServerResponse, sent };
}

function request(authorization: string, body: unknown): IncomingMessage {
  return { method: "POST", headers: { authorization }, body } as unknown as IncomingMessage;
}

function parse(sent: { body: string }) {
  return JSON.parse(sent.body) as Record<string, unknown>;
}

test("archived RevenueCat webhooks fail closed without processing", async () => {
  const { res, sent } = response();
  await handleRevenueCatWebhook(request("Bearer expected-secret", { event: { type: "INITIAL_PURCHASE" } }), res, {
    REVENUECAT_ARCHIVED: "true",
    REVENUECAT_WEBHOOK_AUTHORIZATION: "expected-secret",
  });
  assert.equal(sent.status, 503);
});

test("a webhook without the configured secret is rejected", async () => {
  const { res, sent } = response();
  await handleRevenueCatWebhook(request("Bearer wrong", { event: { type: "INITIAL_PURCHASE" } }), res, {
    REVENUECAT_ARCHIVED: "false",
    REVENUECAT_WEBHOOK_AUTHORIZATION: "expected-secret",
  });
  assert.equal(sent.status, 401);
});

test("missing webhook authorization configuration fails closed", async () => {
  const { res, sent } = response();
  await handleRevenueCatWebhook(request("Bearer anything", { event: { type: "INITIAL_PURCHASE" } }), res, {
    REVENUECAT_ARCHIVED: "false",
  });
  assert.equal(sent.status, 503);
});

test("failed database writes do not mark the event processed and retries can apply", async () => {
  const ledger = createMemoryWebhookLedger();
  const userId = randomUUID();
  const env = { REVENUECAT_ARCHIVED: "false", REVENUECAT_WEBHOOK_AUTHORIZATION: "expected-secret" };
  const deps = { applyEvent: async (_env: typeof env, input: Parameters<typeof ledger.apply>[0]) => ledger.apply(input) };

  ledger.failNextWrite();
  const first = response();
  await handleRevenueCatWebhook(
    request("Bearer expected-secret", {
      event: {
        id: "evt-fail-then-ok",
        type: "INITIAL_PURCHASE",
        app_user_id: userId,
        product_id: "next_level_monthly",
        expiration_at_ms: Date.parse("2026-12-15T00:00:00.000Z"),
      },
    }),
    first.res,
    env,
    deps,
  );
  assert.equal(first.sent.status, 503);
  assert.equal(ledger.getAccount(userId), null);

  const second = response();
  await handleRevenueCatWebhook(
    request("Bearer expected-secret", {
      event: {
        id: "evt-fail-then-ok",
        type: "INITIAL_PURCHASE",
        app_user_id: userId,
        product_id: "next_level_monthly",
        expiration_at_ms: Date.parse("2026-12-15T00:00:00.000Z"),
      },
    }),
    second.res,
    env,
    deps,
  );
  assert.equal(second.sent.status, 200);
  assert.equal(parse(second.sent).applied, true);
  assert.equal(ledger.getAccount(userId)?.storeStatus, "active");
  assert.equal(ledger.getAccount(userId)?.storeProductId, "next_level_monthly");
});

test("duplicate webhook event ids are acknowledged without re-applying", async () => {
  const ledger = createMemoryWebhookLedger();
  const userId = randomUUID();
  const env = { REVENUECAT_ARCHIVED: "false", REVENUECAT_WEBHOOK_AUTHORIZATION: "expected-secret" };
  const deps = { applyEvent: async (_env: typeof env, input: Parameters<typeof ledger.apply>[0]) => ledger.apply(input) };
  const payload = {
    event: {
      id: "evt-dup",
      type: "INITIAL_PURCHASE",
      app_user_id: userId,
      product_id: "the_pantheon_monthly",
      expiration_at_ms: Date.parse("2026-12-20T00:00:00.000Z"),
    },
  };

  const first = response();
  await handleRevenueCatWebhook(request("Bearer expected-secret", payload), first.res, env, deps);
  assert.equal(parse(first.sent).applied, true);

  const second = response();
  await handleRevenueCatWebhook(request("Bearer expected-secret", payload), second.res, env, deps);
  assert.equal(second.sent.status, 200);
  assert.equal(parse(second.sent).duplicate, true);
  assert.equal(parse(second.sent).applied, false);
});

test("product upgrades and expirations update the membership ledger", async () => {
  const ledger = createMemoryWebhookLedger();
  const userId = randomUUID();
  const env = { REVENUECAT_ARCHIVED: "false", REVENUECAT_WEBHOOK_AUTHORIZATION: "expected-secret" };
  const deps = { applyEvent: async (_env: typeof env, input: Parameters<typeof ledger.apply>[0]) => ledger.apply(input) };

  const upgrade = response();
  await handleRevenueCatWebhook(
    request("Bearer expected-secret", {
      event: {
        id: "evt-upgrade",
        type: "PRODUCT_CHANGE",
        app_user_id: userId,
        product_id: "the_pantheon_monthly",
        expiration_at_ms: Date.parse("2027-01-01T00:00:00.000Z"),
      },
    }),
    upgrade.res,
    env,
    deps,
  );
  assert.equal(parse(upgrade.sent).applied, true);
  assert.equal(ledger.getAccount(userId)?.storeProductId, "the_pantheon_monthly");
  assert.equal(ledger.getAccount(userId)?.storeStatus, "active");

  const expired = response();
  await handleRevenueCatWebhook(
    request("Bearer expected-secret", {
      event: {
        id: "evt-expire",
        type: "EXPIRATION",
        app_user_id: userId,
        product_id: "the_pantheon_monthly",
        expiration_at_ms: Date.parse("2026-11-01T00:00:00.000Z"),
      },
    }),
    expired.res,
    env,
    deps,
  );
  assert.equal(parse(expired.sent).applied, true);
  assert.equal(ledger.getAccount(userId)?.storeStatus, "expired");
});

test("billing issue and renewal events are recorded without granting unknown products", async () => {
  const ledger = createMemoryWebhookLedger();
  const userId = randomUUID();
  const env = { REVENUECAT_ARCHIVED: "false", REVENUECAT_WEBHOOK_AUTHORIZATION: "expected-secret" };
  const deps = { applyEvent: async (_env: typeof env, input: Parameters<typeof ledger.apply>[0]) => ledger.apply(input) };

  const unknown = response();
  await handleRevenueCatWebhook(
    request("Bearer expected-secret", {
      event: {
        id: "evt-unknown",
        type: "INITIAL_PURCHASE",
        app_user_id: userId,
        product_id: "legacy_pro_monthly",
      },
    }),
    unknown.res,
    env,
    deps,
  );
  assert.equal(parse(unknown.sent).applied, false);
  assert.equal(ledger.getAccount(userId), null);

  const billing = response();
  await handleRevenueCatWebhook(
    request("Bearer expected-secret", {
      event: {
        id: "evt-billing",
        type: "BILLING_ISSUE",
        app_user_id: userId,
        product_id: "next_level_monthly",
        expiration_at_ms: Date.parse("2026-12-01T00:00:00.000Z"),
      },
    }),
    billing.res,
    env,
    deps,
  );
  assert.equal(parse(billing.sent).applied, true);
  assert.equal(ledger.getAccount(userId)?.storeStatus, "billing_issue");
});

test("a complimentary trial can be used once and a cancellation keeps its expiration", async (t) => {
  const url = process.env.SUPABASE_DB_URL?.trim();
  if (!url) {
    t.skip("membership ledger is not configured in this environment");
    return;
  }
  const userId = randomUUID();
  const sql = postgres(url, { max: 1, idle_timeout: 1, onnotice: () => undefined });
  try {
    assert.equal(await startComplimentaryTrial(process.env, userId), "started");
    assert.equal(await startComplimentaryTrial(process.env, userId), "used");
    const trial = await readMembershipRecord(process.env, userId);
    assert.equal(trial?.trialUsed, true);

    const ledger = createMemoryWebhookLedger();
    const { res, sent } = response();
    await handleRevenueCatWebhook(
      request("Bearer expected-secret", {
        event: {
          id: "evt-cancel-live",
          type: "CANCELLATION",
          app_user_id: userId,
          product_id: "the_pantheon_monthly",
          expiration_at_ms: Date.parse("2026-12-15T00:00:00.000Z"),
        },
      }),
      res,
      { ...process.env, REVENUECAT_ARCHIVED: "false", REVENUECAT_WEBHOOK_AUTHORIZATION: "expected-secret" },
      { applyEvent: async (_env, input) => ledger.apply(input) },
    );
    assert.equal(sent.status, 200);
    assert.equal(ledger.getAccount(userId)?.storeStatus, "canceled");
    assert.equal(ledger.getAccount(userId)?.storeProductId, "the_pantheon_monthly");
    assert.equal(ledger.getAccount(userId)?.storeExpiresAt, "2026-12-15T00:00:00.000Z");
  } finally {
    await sql`delete from public.membership_accounts where user_id = ${userId}`.catch(() => undefined);
    await sql`delete from public.membership_webhook_events where user_id = ${userId}`.catch(() => undefined);
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
});
