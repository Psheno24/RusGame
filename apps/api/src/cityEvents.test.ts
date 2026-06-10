import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeIncomeMultiplier,
  getIncomeMultiplierBreakdown,
  isEvening,
  isFixedHoliday,
  isWeekend,
} from "./incomeMultiplier.js";
import { getCityEventState, generateCityEventsForSlot } from "./cityEventsEngine.js";
import { generateWeather } from "./cityWeather.js";
import { COMMON_EVENTS, getUniqueEventsForCity } from "./cityEventsCatalog.js";
import { effectDirection, eventConflictsWithAxes, registerEventAxes } from "./cityEventConflicts.js";

function lookupTemplate(id: string) {
  return COMMON_EVENTS.find((e) => e.id === id) ?? getUniqueEventsForCity("moscow").find((e) => e.id === id);
}

function hasOppositeConflict(events: ReturnType<typeof generateCityEventsForSlot>): boolean {
  const axes = new Set<string>();
  for (const ev of events) {
    const tmpl = lookupTemplate(ev.templateId);
    if (!tmpl) continue;
    if (eventConflictsWithAxes(tmpl, axes)) return true;
    for (const def of tmpl.effects) {
      const dir = effectDirection(def);
      if (dir) axes.add(`${def.type}:${dir}`);
    }
  }
  return false;
}

describe("incomeMultiplier", () => {
  const tz = "Europe/Moscow";

  it("weekday daytime base is 1.0", () => {
    const now = Date.parse("2026-03-04T09:00:00.000Z");
    const bd = computeIncomeMultiplier(12, tz, now, [], false, { mode: "taxi" });
    assert.equal(bd.total, 1.0);
  });

  it("evening adds 0.2", () => {
    const now = Date.parse("2026-03-04T16:00:00.000Z");
    const bd = computeIncomeMultiplier(19, tz, now, [], false, { mode: "taxi" });
    assert.equal(bd.total, 1.2);
    assert.equal(isEvening(19), true);
  });

  it("weekend adds 0.3", () => {
    const now = Date.parse("2026-03-07T09:00:00.000Z");
    const bd = computeIncomeMultiplier(12, tz, now, [], false, { mode: "taxi" });
    assert.equal(bd.total, 1.3);
    assert.equal(isWeekend(tz, now), true);
  });

  it("evening weekend stacks to 1.5", () => {
    const now = Date.parse("2026-03-07T16:00:00.000Z");
    const bd = computeIncomeMultiplier(19, tz, now, [], false, { mode: "taxi" });
    assert.equal(bd.total, 1.5);
  });

  it("event taxi demand stacks additively", () => {
    const now = Date.parse("2026-03-07T16:00:00.000Z");
    const bd = computeIncomeMultiplier(19, tz, now, [{ type: "taxiDemand", value: 0.3 }], false, {
      mode: "taxi",
    });
    assert.equal(bd.total, 1.8);
  });

  it("fixed holiday counts", () => {
    const now = Date.parse("2026-01-01T10:00:00.000Z");
    assert.equal(isFixedHoliday(tz, now), true);
    const bd = computeIncomeMultiplier(13, tz, now, [], false, { mode: "delivery" });
    assert.equal(bd.total, 1.3);
  });

  it("live breakdown includes event effects", () => {
    const now = Date.now();
    const bd = getIncomeMultiplierBreakdown("moscow", now, { mode: "taxi" });
    assert.ok(bd.total >= 1.0);
  });
});

describe("cityEventsEngine", () => {
  it("generates events and weather for city", () => {
    const now = Date.now();
    const state = getCityEventState("moscow", now);
    assert.ok(state.events.length >= 1);
    assert.ok(state.weather.tempC !== undefined);
    assert.ok(state.nextEventsRefreshAt > now);
    assert.ok(state.nextWeatherRefreshAt > now);
  });

  it("persists events across repeated loads in the same slot", () => {
    const cityId = "test_slot_persist";
    const now = Date.parse("2026-03-04T10:00:00.000Z");
    const a = getCityEventState(cityId, now);
    const b = getCityEventState(cityId, now + 12_000);
    assert.deepEqual(
      a.events.map((e) => e.templateId),
      b.events.map((e) => e.templateId),
    );
  });

  it("winter siberian weather is cold", () => {
    const now = Date.parse("2026-01-15T06:00:00.000Z");
    const w = generateWeather("omsk", now);
    assert.ok(w.tempC <= 5, `expected cold, got ${w.tempC}`);
  });

  it("summer southern weather is warm", () => {
    const now = Date.parse("2026-07-15T09:00:00.000Z");
    const w = generateWeather("krasnodar", now);
    assert.ok(w.tempC >= 15, `expected warm, got ${w.tempC}`);
  });

  it("never generates opposite effects on the same axis", () => {
    for (let slot = 0; slot < 500; slot++) {
      const events = generateCityEventsForSlot("moscow", slot * 3_600_000);
      assert.equal(hasOppositeConflict(events), false, `slot ${slot}: ${events.map((e) => e.templateId).join(", ")}`);
    }
  });

  it("allows same-direction effects to stack", () => {
    let found = false;
    for (let slot = 0; slot < 3000; slot++) {
      const events = generateCityEventsForSlot("moscow", slot * 3_600_000);
      const ids = events.map((e) => e.templateId);
      if (ids.includes("delivery_boom") && ids.includes("food_fest")) {
        found = true;
        break;
      }
    }
    assert.ok(found, "delivery_boom and food_fest (both +delivery) should stack sometimes");
  });

  it("at most one unique city event per slot", () => {
    for (let slot = 0; slot < 500; slot++) {
      const events = generateCityEventsForSlot("moscow", slot * 3_600_000);
      const uniqueCount = events.filter((e) => e.unique).length;
      assert.ok(uniqueCount <= 1, `slot ${slot} has ${uniqueCount} unique events`);
    }
  });
});

describe("cityEventConflicts", () => {
  it("fuel up conflicts with fuel down but not with itself axis duplicate from another + fuel event", () => {
    const fuelUp = COMMON_EVENTS.find((e) => e.id === "fuel_up")!;
    const fuelDown = COMMON_EVENTS.find((e) => e.id === "fuel_down")!;
    const axes = new Set<string>();
    registerEventAxes(fuelUp, axes);
    assert.equal(eventConflictsWithAxes(fuelDown, axes), true);
    assert.equal(eventConflictsWithAxes(fuelUp, axes), false);
  });
});
