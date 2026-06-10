import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPercentModifier,
  applyTravelDurationMs,
  applyWorkReputationGain,
  travelDurationMultiplier,
} from "./cityEffectModifiers.js";

describe("cityEffectModifiers", () => {
  it("applyPercentModifier rounds price changes", () => {
    assert.equal(applyPercentModifier(1000, 10), 1100);
    assert.equal(applyPercentModifier(1000, -10), 900);
  });

  it("travelDurationMultiplier slows trips when speed is negative", () => {
    assert.ok(travelDurationMultiplier(-30) > 1);
    assert.ok(travelDurationMultiplier(20) < 1);
  });

  it("applyTravelDurationMs uses city weather movement effects", () => {
    const base = 3_600_000;
    const adjusted = applyTravelDurationMs(base, "moscow", Date.now());
    assert.ok(adjusted >= 60_000);
  });

  it("applyWorkReputationGain returns at least zero", () => {
    assert.ok(applyWorkReputationGain(2, "omsk", Date.now()) >= 0);
  });
});
