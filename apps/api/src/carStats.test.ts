import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { comfortToTaxiTariff } from "./taxiTariff.js";
import { prestigeToMoodBonus, speedToCooldownReducePct } from "./carStats.js";

describe("carStats", () => {
  it("speed cooldown caps at 25%", () => {
    assert.equal(speedToCooldownReducePct(20), 5);
    assert.equal(speedToCooldownReducePct(100), 25);
  });

  it("comfort maps to taxi tariff", () => {
    assert.equal(comfortToTaxiTariff(30), "economy");
    assert.equal(comfortToTaxiTariff(45), "comfort");
    assert.equal(comfortToTaxiTariff(65), "comfort_plus");
    assert.equal(comfortToTaxiTariff(85), "business");
    assert.equal(comfortToTaxiTariff(95), "premium");
  });

  it("prestige mood bonus", () => {
    assert.equal(prestigeToMoodBonus(10), 0);
    assert.equal(prestigeToMoodBonus(50), 2);
    assert.equal(prestigeToMoodBonus(100), 10);
  });
});
