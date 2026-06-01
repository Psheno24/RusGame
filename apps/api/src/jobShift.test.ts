import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeNightGuardShiftMinutes,
  getJobCooldownLabel,
  getShiftDurationLabel,
  jobNominalCooldownMs,
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

  it("cashier cooldown matches shiftHours", () => {
    assert.equal(
      jobNominalCooldownMs({ kind: "cooldown", shiftHours: 8, cooldownMs: 43_200_000 }),
      8 * 3_600_000,
    );
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

  it("shift cooldown labels match button timers", () => {
    assert.equal(
      getJobCooldownLabel({ kind: "duration", shiftHoursMin: 4, shiftHoursMax: 12 }),
      "4–12 ч",
    );
    assert.equal(getJobCooldownLabel({ kind: "duration", shiftHoursMin: 4, shiftHoursMax: 12 }, { selectedShiftHours: 8 }), "8 ч");
    assert.equal(getJobCooldownLabel({ kind: "duration", shiftHoursMin: 4, shiftHoursMax: 12 }, { lastShiftHours: 6 }), "6 ч");
    assert.equal(getJobCooldownLabel({ kind: "cooldown", shiftHours: 8 }), "8 ч");
    assert.equal(getJobCooldownLabel({ kind: "cooldown", cooldownMs: 86_400_000 }), "1 дн");
    assert.equal(
      getJobCooldownLabel({ kind: "cooldown", cooldownMs: 86_400_000 }, { remainingMs: 86_298_000 }),
      "23 ч 58 мин",
    );
  });
});
