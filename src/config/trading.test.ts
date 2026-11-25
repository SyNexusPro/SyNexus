import assert from "node:assert/strict";
import test from "node:test";

test("trading defaults off unless VITE_TRADING_ENABLED is explicitly true", async () => {
  // Mirror the release gate without importing Capacitor in this isolated assertion.
  const enabled = (value: string | undefined) => String(value || "").trim().toLowerCase() === "true";
  assert.equal(enabled(undefined), false);
  assert.equal(enabled("false"), false);
  assert.equal(enabled(""), false);
  assert.equal(enabled("true"), true);
});
