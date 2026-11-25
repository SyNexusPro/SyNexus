import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import test from "node:test";
import { handlePaddleWebhook } from "../../../api/_routes/paddle/webhook.ts";
import { createMemoryWebhookLedger } from "../membership/store.ts";
import { mapPaddleWebhookEvent, verifyPaddleWebhookSignature } from "./paddleWebhook.ts";

function sign(rawBody: string, secret: string, ts = Math.floor(Date.now() / 1000)): string {
  const h1 = createHmac("sha256", secret).update(`${ts}:${rawBody}`, "utf8").digest("hex");
  return `ts=${ts};h1=${h1}`;
}

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

function request(signature: string, body: string): IncomingMessage {
  return {
    method: "POST",
    headers: { "paddle-signature": signature },
    body,
  } as unknown as IncomingMessage;
}

function parse(sent: { body: string }) {
  return JSON.parse(sent.body) as Record<string, unknown>;
}

test("paddle signature verification accepts a fresh signed payload", () => {
  const body = '{"event_id":"evt_1"}';
  const secret = "test-secret";
  assert.equal(verifyPaddleWebhookSignature(body, sign(body, secret), secret), true);
  assert.equal(verifyPaddleWebhookSignature(body, sign(body, "other"), secret), false);
  assert.equal(verifyPaddleWebhookSignature(body, "", secret), false);
});

test("subscription.created maps into the membership ledger shape", () => {
  const userId = randomUUID();
  const mapped = mapPaddleWebhookEvent(
    {
      event_id: "evt_sub_1",
      event_type: "subscription.created",
      data: {
        status: "active",
        custom_data: { user_id: userId },
        items: [{ price: { id: "pri_next" } }],
        current_billing_period: { ends_at: "2026-12-15T00:00:00.000Z" },
      },
    },
    { VITE_PADDLE_NEXT_LEVEL_PRICE_ID: "pri_next" },
  );
  assert.equal(mapped.kind, "apply");
  if (mapped.kind !== "apply") return;
  assert.equal(mapped.input.eventId, "paddle:evt_sub_1");
  assert.equal(mapped.input.userId, userId);
  assert.equal(mapped.input.productId, "starter_monthly");
  assert.equal(mapped.input.status, "active");
  assert.equal(mapped.input.expiresAt, "2026-12-15T00:00:00.000Z");
  assert.equal(mapped.input.markTrialUsed, true);
  assert.equal(mapped.input.provider, "paddle");
});

test("past_due and canceled map to billing_issue and canceled", () => {
  const userId = randomUUID();
  const pastDue = mapPaddleWebhookEvent(
    {
      event_id: "evt_past",
      event_type: "subscription.past_due",
      data: {
        status: "past_due",
        id: "sub_01past",
        customer_id: "ctm_01past",
        custom_data: { user_id: userId },
        items: [{ price: { id: "pri_next" } }],
      },
    },
    { VITE_PADDLE_NEXT_LEVEL_PRICE_ID: "pri_next" },
  );
  assert.equal(pastDue.kind, "apply");
  if (pastDue.kind === "apply") {
    assert.equal(pastDue.input.status, "billing_issue");
    assert.equal(pastDue.input.paddleCustomerId, "ctm_01past");
  }

  const canceled = mapPaddleWebhookEvent(
    {
      event_id: "evt_cancel",
      event_type: "subscription.canceled",
      data: {
        status: "canceled",
        custom_data: { user_id: userId },
        items: [{ price: { id: "pri_next" } }],
      },
    },
    { VITE_PADDLE_NEXT_LEVEL_PRICE_ID: "pri_next" },
  );
  assert.equal(canceled.kind, "apply");
  if (canceled.kind === "apply") assert.equal(canceled.input.status, "canceled");
});

test("paddle webhook rejects missing configuration and bad signatures", async () => {
  const body = JSON.stringify({ event_id: "evt_x", event_type: "subscription.created", data: {} });
  const missing = response();
  await handlePaddleWebhook(request(sign(body, "secret"), body), missing.res, {});
  assert.equal(missing.sent.status, 503);

  const bad = response();
  await handlePaddleWebhook(request(sign(body, "wrong"), body), bad.res, {
    PADDLE_API_KEY: "pdl_live_key",
    PADDLE_WEBHOOK_SECRET: "expected",
  });
  assert.equal(bad.sent.status, 500);
});

test("verified paddle subscription events apply through the shared ledger", async () => {
  const ledger = createMemoryWebhookLedger();
  const userId = randomUUID();
  const secret = "paddle-secret";
  const env = {
    PADDLE_API_KEY: "pdl_live_key",
    PADDLE_WEBHOOK_SECRET: secret,
    VITE_PADDLE_PANTHEON_PRICE_ID: "pri_pantheon",
  };
  const deps = {
    applyEvent: async (_env: typeof env, input: Parameters<typeof ledger.apply>[0]) => ledger.apply(input),
  };
  const payload = JSON.stringify({
    event_id: "evt_apply_1",
    event_type: "subscription.created",
    data: {
      status: "active",
      custom_data: { user_id: userId },
      items: [{ price: { id: "pri_pantheon" } }],
      current_billing_period: { ends_at: "2027-01-01T00:00:00.000Z" },
    },
  });

  const first = response();
  await handlePaddleWebhook(request(sign(payload, secret), payload), first.res, env, deps);
  assert.equal(first.sent.status, 200);
  assert.equal(parse(first.sent).applied, true);
  assert.equal(ledger.getAccount(userId)?.storeProductId, "the_pantheon_monthly");
  assert.equal(ledger.getAccount(userId)?.storeStatus, "active");

  const second = response();
  await handlePaddleWebhook(request(sign(payload, secret), payload), second.res, env, deps);
  assert.equal(second.sent.status, 200);
  assert.equal(parse(second.sent).duplicate, true);
});
