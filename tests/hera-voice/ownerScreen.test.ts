import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOwnerScreen } from "../../src/lib/ownerScreen";

describe("isOwnerScreen", () => {
  it("is false for a normal browser", () => {
    assert.equal(isOwnerScreen("Mozilla/5.0 (Macintosh) Chrome/120.0.0.0"), false);
    assert.equal(isOwnerScreen(""), false);
  });

  it("is true only for the owner phone app", () => {
    assert.equal(isOwnerScreen("Mozilla/5.0 TitanHeraOwner"), true);
  });
});
