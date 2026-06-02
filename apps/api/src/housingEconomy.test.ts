import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeHousingEconomy, monthlyGrossRentRub } from "./housingEconomy.js";

describe("housingEconomy", () => {
  it("gross rent is 0.5% of price", () => {
    assert.equal(monthlyGrossRentRub(10_000_000), 50_000);
    assert.equal(monthlyGrossRentRub(1_000_000_000), 5_000_000);
  });

  it("studio example from spec", () => {
    const e = computeHousingEconomy(10_000_000, { prestige: 15, expenseTypePct: 1 });
    assert.equal(e.monthlyRentRub, 50_000);
    assert.equal(e.monthlyExpensesRub, 8_000);
    assert.equal(e.monthlyNetIncomeRub, 42_000);
  });

  it("penthouse example from spec", () => {
    const e = computeHousingEconomy(1_000_000_000, { prestige: 80, expenseTypePct: 15 });
    assert.equal(e.monthlyRentRub, 5_000_000);
    assert.equal(e.monthlyExpensesRub, 2_250_000);
    assert.equal(e.monthlyNetIncomeRub, 2_750_000);
  });

  it("residence example from spec", () => {
    const e = computeHousingEconomy(10_000_000_000, { prestige: 100, expenseTypePct: 20 });
    assert.equal(e.monthlyRentRub, 50_000_000);
    assert.equal(e.monthlyExpensesRub, 27_500_000);
    assert.equal(e.monthlyNetIncomeRub, 22_500_000);
  });
});
