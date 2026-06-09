import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDuration, formatHousingRemaining } from "./formatDuration.js";

describe("formatDuration", () => {
  it("zero and negative", () => {
    assert.equal(formatDuration(0), "готово");
    assert.equal(formatDuration(-1), "готово");
  });

  it("under one minute in seconds", () => {
    assert.equal(formatDuration(1000), "1 сек");
    assert.equal(formatDuration(45_000), "45 сек");
    assert.equal(formatDuration(59_999), "60 сек");
  });

  it("one to 59 minutes", () => {
    assert.equal(formatDuration(60_000), "1 мин");
    assert.equal(formatDuration(90_000), "2 мин");
    assert.equal(formatDuration(59 * 60_000), "59 мин");
  });

  it("hours and minutes", () => {
    assert.equal(formatDuration(3_600_000), "1 ч");
    assert.equal(formatDuration(3_660_000), "1 ч 1 мин");
    assert.equal(formatDuration(7 * 3_600_000 + 32 * 60_000), "7 ч 32 мин");
  });

  it("days and hours under 7 days", () => {
    assert.equal(formatDuration(86_400_000), "1 дн");
    assert.equal(formatDuration(86_400_000 + 5 * 3_600_000), "1 дн 5 ч");
    assert.equal(formatDuration(6 * 86_400_000 + 12 * 3_600_000), "6 дн 12 ч");
  });

  it("seven days and more in days only", () => {
    assert.equal(formatDuration(7 * 86_400_000), "7 дн");
    assert.equal(formatDuration(8 * 86_400_000), "8 дн");
    assert.equal(formatDuration(7 * 86_400_000 + 12 * 3_600_000), "8 дн");
  });
});

describe("formatHousingRemaining", () => {
  const now = 1_700_000_000_000;

  it("expired", () => {
    assert.equal(formatHousingRemaining(now - 1, now), "истекло");
  });

  it("days and hours", () => {
    assert.equal(formatHousingRemaining(now + 2 * 86_400_000 + 5 * 3_600_000, now), "2 дн 5 ч");
    assert.equal(formatHousingRemaining(now + 86_400_000, now), "1 дн");
  });

  it("hours and minutes under one day", () => {
    assert.equal(formatHousingRemaining(now + 3 * 3_600_000 + 25 * 60_000, now), "3 ч 25 мин");
    assert.equal(formatHousingRemaining(now + 2 * 3_600_000, now), "2 ч");
  });
});
