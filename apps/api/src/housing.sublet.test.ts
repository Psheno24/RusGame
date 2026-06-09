import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  subletIncomeForOwned,
  subletIncomeForProperty,
  subletRepayAmount,
} from "./housing.js";
import { getHousingProperty } from "./housingCatalog.js";
import type { OwnedHousingRow } from "./playerOwnedHousing.js";

describe("housing sublet", () => {
  it("studio in Omsk: bible sublet income 0.4–0.6% monthly", () => {
    const oneDay = 24 * 60 * 60 * 1000;
    const month = 30 * oneDay;
    const prop = getHousingProperty("omsk", "omsk_studio");
    assert.ok(prop);
    const minMonth = Math.round(prop!.priceRub * 0.004);
    const maxMonth = Math.round(prop!.priceRub * 0.006);
    const income = subletIncomeForProperty("omsk", "omsk_studio", month);
    assert.ok(income >= Math.round(minMonth * 0.85));
    assert.ok(income <= Math.round(maxMonth * 1.15));
    assert.ok(subletIncomeForProperty("omsk", "omsk_studio", oneDay) > 0);
  });

  it("penthouse in Omsk: positive bible sublet income", () => {
    const month = 30 * 24 * 60 * 60 * 1000;
    const income = subletIncomeForProperty("omsk", "omsk_penthouse", month);
    assert.ok(income > 50_000);
  });

  it("repay is unpaid contracted sublet amount", () => {
    const now = 1_000_000;
    const row: OwnedHousingRow = {
      id: 1,
      user_id: 1,
      city_id: "omsk",
      property_id: "omsk_studio",
      acquired_at: 0,
      sublet_from: now,
      sublet_until: now + 24 * 60 * 60 * 1000,
      sublet_income_rub: 70,
      sublet_paid_rub: 35,
      sublet_next_payout_at: now,
      sublet_retry_at: null,
      sublet_retry_chance: null,
    };
    assert.equal(subletRepayAmount(row, now + 12 * 60 * 60 * 1000), 35);
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
      sublet_paid_rub: 0,
      sublet_next_payout_at: null,
      sublet_retry_at: null,
      sublet_retry_chance: null,
    };
    assert.ok(subletIncomeForOwned(row, month) > 0);
  });
});
