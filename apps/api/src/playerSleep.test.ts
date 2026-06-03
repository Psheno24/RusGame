import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SLEEP_MS_FOR_FULL_ENERGY,
  currentSleepEnergy,
  energyFromSleep,
  maxSleepMsForEnergy,
  previewEnergyAfterSleep,
} from "./playerSleep.js";

describe("playerSleep energy", () => {
  it("4h sleep from 0 gives 100 energy", () => {
    assert.equal(energyFromSleep(0, SLEEP_MS_FOR_FULL_ENERGY, SLEEP_MS_FOR_FULL_ENERGY), 100);
  });

  it("2h sleep from 50 gives 100 energy", () => {
    const twoHours = SLEEP_MS_FOR_FULL_ENERGY / 2;
    assert.equal(energyFromSleep(50, twoHours, twoHours), 100);
  });

  it("preview caps at 100", () => {
    const p = {
      energy: 90,
      sleep_start_energy: 90,
    } as import("./db.js").PlayerRow;
    assert.equal(previewEnergyAfterSleep(p, SLEEP_MS_FOR_FULL_ENERGY), 100);
  });

  it("maxSleepMsForEnergy caps at 4h and shrinks when energy is high", () => {
    assert.equal(maxSleepMsForEnergy(0), SLEEP_MS_FOR_FULL_ENERGY);
    assert.equal(maxSleepMsForEnergy(50), SLEEP_MS_FOR_FULL_ENERGY / 2);
    assert.equal(maxSleepMsForEnergy(100), 15 * 60 * 1000);
  });

  it("currentSleepEnergy grows with elapsed time", () => {
    const now = 1_000_000;
    const p = {
      energy: 20,
      sleep_started_at: now - 60 * 60 * 1000,
      sleep_planned_ms: SLEEP_MS_FOR_FULL_ENERGY,
      sleep_start_energy: 20,
    } as import("./db.js").PlayerRow;
    const e = currentSleepEnergy(p, now);
    assert.ok(e > 20 && e <= 100);
  });
});
