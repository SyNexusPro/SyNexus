import assert from "node:assert/strict";
import { test } from "node:test";
import { authorizeCronRequest, openWhenSecretMissing } from "./cronGuard.ts";

test("production does not run a cron with no secret", () => {
  assert.equal(openWhenSecretMissing({ VERCEL_ENV: "production" }), false);
  assert.equal(openWhenSecretMissing({}), true);
  assert.equal(openWhenSecretMissing({ VERCEL_ENV: "preview" }), true);
});

test("authorizeCronRequest accepts bearer and header secrets", () => {
  const env = { CRON_SECRET: "cron-test-secret" };
  assert.equal(
    authorizeCronRequest({ headers: { authorization: "Bearer cron-test-secret" } }, env),
    true,
  );
  assert.equal(
    authorizeCronRequest({ headers: { "x-cron-secret": "cron-test-secret" } }, env),
    true,
  );
  assert.equal(authorizeCronRequest({ headers: {} }, env), false);
  assert.equal(
    authorizeCronRequest({ headers: {} }, { VERCEL_ENV: "production" }),
    false,
  );
});
