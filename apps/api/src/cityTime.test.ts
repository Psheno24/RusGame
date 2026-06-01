import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCityLocalTime,
  getPayoutMultiplier,
  getTimeOfDayPeriod,
  isDayTime,
  isHourInRange,
  isWorkScheduleAllowed,
} from "./cityTime.js";

describe("cityTime", () => {
  it("day/night boundaries", () => {
    const schedule = { mode: "night" as const, dayStartHour: 6, nightStartHour: 22 };
    assert.equal(isDayTime(5 * 60 + 59, schedule), false);
    assert.equal(isDayTime(6 * 60, schedule), true);
    assert.equal(isDayTime(21 * 60 + 59, schedule), true);
    assert.equal(isDayTime(22 * 60, schedule), false);
  });

  it("schedule night mode at 14:00 MSK", () => {
    const tz = "Europe/Moscow";
    const now = Date.parse("2026-06-01T11:00:00.000Z");
    const local = getCityLocalTime(tz, now);
    assert.equal(local.hour, 14);
    const allowed = isWorkScheduleAllowed(local, { mode: "night", nightStartHour: 22, dayStartHour: 6 });
    assert.equal(allowed, false);
  });

  it("schedule night mode at 23:00 MSK", () => {
    const tz = "Europe/Moscow";
    const now = Date.parse("2026-06-01T20:00:00.000Z");
    const local = getCityLocalTime(tz, now);
    assert.equal(local.hour, 23);
    const allowed = isWorkScheduleAllowed(local, { mode: "night", nightStartHour: 22, dayStartHour: 6 });
    assert.equal(allowed, true);
  });

  it("payout periods across midnight", () => {
    assert.equal(isHourInRange(23, 22, 6), true);
    assert.equal(isHourInRange(5, 22, 6), true);
    assert.equal(isHourInRange(12, 22, 6), false);
    const periods = [
      { fromHour: 7, toHour: 10, multiplier: 1.25 },
      { fromHour: 17, toHour: 22, multiplier: 1.25 },
      { fromHour: 22, toHour: 6, multiplier: 1.15 },
    ];
    assert.equal(getPayoutMultiplier(8, periods), 1.25);
    assert.equal(getPayoutMultiplier(18, periods), 1.25);
    assert.equal(getPayoutMultiplier(23, periods), 1.15);
    assert.equal(getPayoutMultiplier(12, periods), 1);
  });

  it("time of day periods", () => {
    assert.equal(getTimeOfDayPeriod(8), "morning");
    assert.equal(getTimeOfDayPeriod(14), "day");
    assert.equal(getTimeOfDayPeriod(19), "evening");
    assert.equal(getTimeOfDayPeriod(23), "night");
  });

  it("Omsk offset differs from Moscow", () => {
    const now = Date.parse("2026-06-01T12:00:00.000Z");
    const msk = getCityLocalTime("Europe/Moscow", now);
    const omsk = getCityLocalTime("Asia/Omsk", now);
    assert.equal(msk.hour, 15);
    assert.equal(omsk.hour, 18);
  });

  it("night guard at 00:28 Omsk is allowed but blocked in Moscow", () => {
    const schedule = { mode: "night" as const, nightStartHour: 22, dayStartHour: 6 };
    const now = Date.parse("2026-05-31T18:28:00.000Z");
    const omsk = getCityLocalTime("Asia/Omsk", now);
    const msk = getCityLocalTime("Europe/Moscow", now);
    assert.equal(omsk.label, "00:28");
    assert.equal(msk.label, "21:28");
    assert.equal(isWorkScheduleAllowed(omsk, schedule), true);
    assert.equal(isWorkScheduleAllowed(msk, schedule), false);
  });
});
