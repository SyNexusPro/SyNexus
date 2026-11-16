import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import test from "node:test";
import { handleOwnerHera } from "../../../api/_routes/owner/hera.ts";
import { handleOwnerOlympus } from "../../../api/_routes/owner/olympus.ts";

function capture() {
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

test("executive routes refuse a caller who is not the owner", async () => {
  const hera = capture();
  await handleOwnerHera({ method: "GET", headers: {}, url: "/api/owner/hera" } as IncomingMessage, hera.res, {
    VAPID_PUBLIC_KEY: "public-key",
    VAPID_PRIVATE_KEY: "private-key",
  });
  assert.equal(hera.sent.status, 401);
  assert.equal(hera.sent.body.includes("private-key"), false);

  const olympus = capture();
  await handleOwnerOlympus({ method: "GET", headers: {}, url: "/api/owner/olympus" } as IncomingMessage, olympus.res, {});
  assert.equal(olympus.sent.status, 401);
});
