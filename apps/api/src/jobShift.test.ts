import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeNightGuardShiftMinutes,
  getShiftDurationLabel,
  nightGuardStaminaEligible,
} from "./jobShift.js";

describe("jobShift", () => {
  it("night guard shift minutes until 8:00", () => {
    assert.equal(computeNightGuardShiftMinutes(22, 0), 10 * 60);
    assert.equal(computeNightGuardShiftMinutes(0, 28), 7 * 60 + 32);
    assert.equal(computeNightGuardShiftMinutes(7, 59), 1);
    assert.equal(computeNightGuardShiftMinutes(8, 0), 0);
    assert.equal(computeNightGuardShiftMinutes(14, 0), 0);
  });

  it("stamina only if more than half of 22–8 window (start before 3:00)", () => {
    assert.equal(nightGuardStaminaEligible({ hour: 22, minute: 0, minutesOfDay: 0, label: "", period: "night", periodLabel: "" }), true);
    assert.equal(nightGuardStaminaEligible({ hour: 2, minute: 59, minutesOfDay: 0, label: "", period: "night", periodLabel: "" }), true);
    assert.equal(nightGuardStaminaEligible({ hour: 3, minute: 0, minutesOfDay: 0, label: "", period: "night", periodLabel: "" }), false);
    assert.equal(nightGuardStaminaEligible({ hour: 5, minute: 0, minutesOfDay: 0, label: "", period: "night", periodLabel: "" }), false);
  });

  it("shift duration labels", () => {
    assert.equal(
      getShiftDurationLabel({ kind: "duration", shiftHoursMin: 4, shiftHoursMax: 12 }),
      "4–12 ч",
    );
    assert.equal(getShiftDurationLabel({ kind: "cooldown", shiftHours: 8 }), "8 ч");
    assert.equal(
      getShiftDurationLabel({ kind: "cooldown", shiftEndsAtHour: 8 }, { hour: 0, minute: 28 }),
      "до 08:00 (7 ч 32 мин)",
    );
  });
});
