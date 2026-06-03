import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canCarFulfillOrderTariff,
  comfortToTaxiTariff,
  orderTariffsAvailableToCar,
  pickWeightedOrderTariff,
} from "./taxiTariff.js";

describe("taxiTariff", () => {
  it("higher car class accepts lower orders", () => {
    assert.equal(canCarFulfillOrderTariff("business", "economy"), true);
    assert.equal(canCarFulfillOrderTariff("comfort", "comfort_plus"), false);
    assert.equal(canCarFulfillOrderTariff("premium", "business"), true);
  });

  it("comfort thresholds", () => {
    assert.equal(comfortToTaxiTariff(39), "economy");
    assert.equal(comfortToTaxiTariff(40), "comfort");
    assert.equal(comfortToTaxiTariff(90), "premium");
  });

  it("pickWeightedOrderTariff returns city tariff", () => {
    const t = pickWeightedOrderTariff(["economy", "business"]);
    assert.ok(t === "economy" || t === "business");
  });

  it("orderTariffsAvailableToCar filters by car class", () => {
    const city = ["economy", "comfort", "comfort_plus", "business", "premium"];
    const allowed = orderTariffsAvailableToCar(city, "comfort");
    assert.deepEqual(allowed, ["economy", "comfort"]);
  });
});
