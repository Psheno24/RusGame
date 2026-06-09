import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SLEEP_MS_FOR_FULL_ENERGY,
  currentSleepEnergy,
  energyFromSleep,
  maxSleepMsForEnergy,
  previewEnergyAfterSleep,
  sleepStartBlockMessage,
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

  it("sleepStartBlockMessage blocks taxi line and active shift", () => {
    const now = 1_000_000;
    const car = { carSelected: true, carSource: "owned", carRefId: 1, carModelId: "granta" };
    const onLine = {
      taxi_state: JSON.stringify({ ...car, onLine: true }),
    } as import("./db.js").PlayerRow;
    assert.match(sleepStartBlockMessage(onLine, now) ?? "", /такси/);

    const onTrip = {
      taxi_state: JSON.stringify({
        ...car,
        onLine: false,
        activeTrip: {
          orderId: "o1",
          startedAt: now - 1000,
          endsAt: now + 60_000,
          order: {
            id: "o1",
            tripMinutes: 10,
            passengerRating: 5,
            payment: "card",
            payoutRub: 500,
            tariff: "economy",
            tariffTitle: "Эконом",
            offeredAt: now - 2000,
          },
        },
      }),
    } as import("./db.js").PlayerRow;
    assert.match(sleepStartBlockMessage(onTrip, now) ?? "", /такси/);

    const onShift = {
      city_id: "ekb",
      job_id: "ekb_night_guard",
      last_work_at_by_job: JSON.stringify({
        ekb_night_guard: { at: now - 60_000, cooldownMs: 3_600_000 },
      }),
    } as import("./db.js").PlayerRow;
    assert.match(sleepStartBlockMessage(onShift, now) ?? "", /смены/);

    assert.equal(sleepStartBlockMessage({ city_id: "ekb" } as import("./db.js").PlayerRow, now), null);
  });

  it("sleepStartBlockMessage blocks travel and delivery", () => {
    const now = 1_000_000;
    const traveling = {
      status: "traveling",
      travel_arrives_at: now + 60_000,
    } as import("./db.js").PlayerRow;
    assert.match(sleepStartBlockMessage(traveling, now) ?? "", /в пути/i);

    const onDelivery = {
      delivery_state: JSON.stringify({
        activeTrip: {
          orderId: "d1",
          startedAt: now - 1000,
          endsAt: now + 120_000,
          order: {
            id: "d1",
            distanceKm: 2,
            transport: "walk",
            modifier: "normal",
            modifierTitle: "Обычный",
            basePayoutRub: 300,
            tripMinutes: 5,
            offeredAt: now - 2000,
          },
        },
        sessionIncomeRub: 0,
        ordersCompleted: 0,
        lastActivityAt: now,
      }),
    } as import("./db.js").PlayerRow;
    assert.match(sleepStartBlockMessage(onDelivery, now) ?? "", /доставк/i);
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
