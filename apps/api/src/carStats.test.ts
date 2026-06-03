import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  comfortToTaxiClass,
  prestigeToMoodBonus,
  speedToCooldownReducePct,
} from "./carStats.js";

describe("carStats", () => {
  it("speed cooldown caps at 25%", () => {
    assert.equal(speedToCooldownReducePct(20), 5);
    assert.equal(speedToCooldownReducePct(100), 25);
  });

  it("comfort maps to taxi class", () => {
    assert.equal(comfortToTaxiClass(30), "economy");
    assert.equal(comfortToTaxiClass(45), "comfort");
    assert.equal(comfortToTaxiClass(65), "comfort_plus");
    assert.equal(comfortToTaxiClass(85), "business");
  });

  it("prestige mood bonus", () => {
    assert.equal(prestigeToMoodBonus(10), 0);
    assert.equal(prestigeToMoodBonus(50), 2);
    assert.equal(prestigeToMoodBonus(100), 10);
  });
});
