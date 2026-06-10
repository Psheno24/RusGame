import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDeliveryOrderBreakdown, buildTaxiOrderBreakdown } from "./linePayoutBreakdown.js";

describe("linePayoutBreakdown", () => {
  it("builds taxi formula with demand and income coef", () => {
    const bd = buildTaxiOrderBreakdown({
      distanceKm: 9.8,
      ratePerKm: 220,
      tariffTitle: "Эконом",
      demandKey: "high",
      demandMult: 1.8,
      cityMult: 1,
      incomeMult: 1,
      incomeHints: [],
      payoutRub: 3881,
    });
    assert.match(bd.formula, /9\.8 км/);
    assert.match(bd.formula, /×1\.8/);
    assert.match(bd.formula, /3\s*881/);
    assert.equal(bd.lines.find((l) => l.label === "Спрос")?.value, "Повышенный ×1.8");
  });

  it("builds delivery formula with modifier and city", () => {
    const bd = buildDeliveryOrderBreakdown({
      distanceKm: 19.2,
      ratePerKm: 165,
      transport: "car",
      modifierTitle: "Короткий",
      modifierMult: 0.8,
      cityMult: 4,
      incomeMult: 1.5,
      incomeHints: ["+0.5 — выходной"],
      payoutRub: 15511,
    });
    assert.match(bd.formula, /19\.2 км/);
    assert.match(bd.formula, /×0\.8/);
    assert.match(bd.formula, /×4/);
    assert.match(bd.formula, /×1\.5/);
    assert.equal(bd.lines.find((l) => l.label === "Тип заказа")?.value, "Короткий ×0.8");
  });
});
