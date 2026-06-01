import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatLocaleDateRu } from "./formatLocaleDate.js";

describe("formatLocaleDateRu", () => {
  it("date without year", () => {
    const ts = Date.UTC(2026, 5, 9, 10, 30);
    const s = formatLocaleDateRu(ts, { timeZone: "UTC" });
    assert.match(s, /9\s+июн/i);
    assert.doesNotMatch(s, /2026|г\./i);
  });

  it("date and time as «дата (время)»", () => {
    const ts = Date.UTC(2026, 5, 9, 1, 8);
    const s = formatLocaleDateRu(ts, { timeZone: "UTC", withTime: true });
    assert.match(s, /9\s+июн/i);
    assert.match(s, /\(01:08\)/);
    assert.doesNotMatch(s, /2026|г\.|,\s*01:08|в\s+01:08/i);
  });
});
