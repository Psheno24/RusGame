import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  subletIncomeForOwned,
  subletIncomeForProperty,
  subletRepayAmount,
} from "./housing.js";
import type { OwnedHousingRow } from "./playerOwnedHousing.js";

describe("housing sublet", () => {
  it("studio in Omsk: net income from catalog", () => {
    const oneDay = 24 * 60 * 60 * 1000;
    const month = 30 * oneDay;
    const income = subletIncomeForProperty("omsk", "omsk_studio", month);
    assert.equal(income, 7_560);
    assert.equal(subletIncomeForProperty("omsk", "omsk_studio", oneDay), 252);
  });

  it("penthouse in Omsk: net income from catalog", () => {
    const month = 30 * 24 * 60 * 60 * 1000;
    const income = subletIncomeForProperty("omsk", "omsk_penthouse", month);
    assert.equal(income, 165_000);
  });

  it("repay is proportional to unused sublet time", () => {
    const now = 1_000_000;
    const row: OwnedHousingRow = {
      id: 1,
      user_id: 1,
      city_id: "omsk",
      property_id: "omsk_studio",
      acquired_at: 0,
      sublet_from: now,
      sublet_until: now + 24 * 60 * 60 * 1000,
      sublet_income_rub: 252,
      sublet_retry_at: null,
      sublet_retry_chance: null,
    };
    assert.equal(subletRepayAmount(row, now + 12 * 60 * 60 * 1000), 126);
    assert.equal(subletRepayAmount(row, now + 24 * 60 * 60 * 1000), 0);
  });

  it("subletIncomeForOwned uses property catalog", () => {
    const month = 30 * 24 * 60 * 60 * 1000;
    const row: OwnedHousingRow = {
      id: 1,
      user_id: 1,
      city_id: "omsk",
      property_id: "omsk_studio",
      acquired_at: 0,
      sublet_from: null,
      sublet_until: null,
      sublet_income_rub: 0,
      sublet_retry_at: null,
      sublet_retry_chance: null,
    };
    assert.equal(subletIncomeForOwned(row, month), 7_560);
  });
});
