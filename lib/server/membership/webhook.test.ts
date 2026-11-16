import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import test from "node:test";
import postgres from "postgres";
import { handleRevenueCatWebhook } from "../../../api/_routes/revenuecat/webhook.ts";
import { readMembershipRecord, startComplimentaryTrial } from "./store.ts";

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

test("a webhook without the configured secret is rejected", async () => {
  const { res, sent } = response();
  await handleRevenueCatWebhook(request("Bearer wrong", { event: { type: "INITIAL_PURCHASE" } }), res, {
    REVENUECAT_WEBHOOK_AUTHORIZATION: "expected-secret",
  });
  assert.equal(sent.status, 401);
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

    const { res, sent } = response();
    await handleRevenueCatWebhook(
      request("Bearer expected-secret", {
        event: {
          type: "CANCELLATION",
          app_user_id: userId,
          product_id: "the_pantheon_monthly",
          expiration_at_ms: Date.parse("2026-12-15T00:00:00.000Z"),
        },
      }),
      res,
      { ...process.env, REVENUECAT_WEBHOOK_AUTHORIZATION: "expected-secret" },
    );
    assert.equal(sent.status, 200);
    const stored = await readMembershipRecord(process.env, userId);
    assert.equal(stored?.storeStatus, "canceled");
    assert.equal(stored?.storeProductId, "the_pantheon_monthly");
    assert.equal(stored?.storeExpiresAt, "2026-12-15T00:00:00.000Z");
  } finally {
    await sql`delete from public.membership_accounts where user_id = ${userId}`.catch(() => undefined);
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
});
