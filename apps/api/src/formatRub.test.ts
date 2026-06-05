import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatRub, formatRubRange, RUB_SUFFIX } from "./formatRub.js";

describe("formatRub", () => {
  it("uses non-breaking space before ruble sign", () => {
    assert.ok(formatRub(2411).endsWith(RUB_SUFFIX));
    assert.ok(!formatRub(2411).endsWith(" ₽"));
    assert.equal(formatRubRange(500, 700), `500–700${RUB_SUFFIX}`);
  });
});
