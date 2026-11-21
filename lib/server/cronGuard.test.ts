import assert from "node:assert/strict";
import { test } from "node:test";
import { openWhenSecretMissing } from "./cronGuard.ts";

test("production does not run a cron with no secret", () => {
  assert.equal(openWhenSecretMissing({ VERCEL_ENV: "production" }), false);
  assert.equal(openWhenSecretMissing({}), true);
  assert.equal(openWhenSecretMissing({ VERCEL_ENV: "preview" }), true);
});
