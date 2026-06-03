import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeHousingEconomy,
  monthlyGrossRentRub,
  weeklyNetIncomeRub,
} from "./housingEconomy.js";

describe("housingEconomy", () => {
  it("gross rent is price / 60 per month", () => {
    assert.equal(monthlyGrossRentRub(600_000), 10_000);
    assert.equal(monthlyGrossRentRub(60_000_000), 1_000_000);
  });

  it("studio example (500k Omsk)", () => {
    const e = computeHousingEconomy(500_000, { prestige: 15, expenseTypePct: 1 });
    assert.equal(e.monthlyRentRub, 8_333);
    assert.equal(e.monthlyExpensesRub, 1_333);
    assert.equal(e.monthlyNetIncomeRub, 7_000);
    assert.equal(e.weeklyNetIncomeRub, 1_750);
    assert.equal(weeklyNetIncomeRub(500_000, 15, 1), 1_750);
  });

  it("penthouse example (30M)", () => {
    const e = computeHousingEconomy(30_000_000, { prestige: 80, expenseTypePct: 15 });
    assert.equal(e.monthlyRentRub, 500_000);
    assert.equal(e.monthlyExpensesRub, 225_000);
    assert.equal(e.monthlyNetIncomeRub, 275_000);
    assert.equal(e.weeklyNetIncomeRub, 68_750);
  });
});
