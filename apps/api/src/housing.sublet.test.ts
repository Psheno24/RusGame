import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { subletIncomeForPeriod, subletRepayAmount } from "./housing.js";
import type { OwnedHousingRow } from "./playerOwnedHousing.js";

describe("housing sublet", () => {
  it("income is rent/30 per day for Omsk tier", () => {
    const oneDay = 24 * 60 * 60 * 1000;
    assert.equal(subletIncomeForPeriod("omsk", oneDay), 600);
    assert.equal(subletIncomeForPeriod("omsk", 30 * oneDay), 18_000);
  });

  it("repay is proportional to unused sublet time", () => {
    const now = 1_000_000;
    const row: OwnedHousingRow = {
      id: 1,
      user_id: 1,
      city_id: "omsk",
      property_id: "x",
      acquired_at: 0,
      sublet_from: now,
      sublet_until: now + 24 * 60 * 60 * 1000,
      sublet_income_rub: 600,
    };
    assert.equal(subletRepayAmount(row, now + 12 * 60 * 60 * 1000), 300);
    assert.equal(subletRepayAmount(row, now + 24 * 60 * 60 * 1000), 0);
  });
});
