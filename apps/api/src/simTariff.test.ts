import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlayerRow } from "./db.js";
import {
  calcUpgradeTopUpRub,
  getWeeklyTariffPrice,
  playerMeetsSimTariff,
  prorateTariffDays,
  processSimTariffBilling,
  SIM_TARIFF_WEEK_MS,
} from "./simTariff.js";

function player(partial: Partial<PlayerRow>): PlayerRow {
  return {
    user_id: 1,
    display_name: "Test",
    rubles: 5000,
    city_id: "omsk",
    status: "idle",
    travel_to_city_id: null,
    travel_arrives_at: null,
    job_id: null,
    agility: 0,
    stamina: 0,
    charisma: 0,
    wit: 0,
    side_gig_ready_at: 0,
    shift_ready_at: 0,
    last_work_at_by_job: null,
    phone_number: "+7 999-000-00-00",
    sim_operator: "999",
    sim_mid: "000",
    sim_last: "0044",
    sim_balance_rub: 2000,
    sim_tariff_id: "minimal",
    sim_tariff_paid_until: 1000 + SIM_TARIFF_WEEK_MS,
    sim_tariff_pending_id: null,
    phone_device_id: "phone1",
    phone_acquired_at: null,
    car_owned: 0,
    car_model_id: null,
    car_acquired_at: null,
    plate_text: null,
    plate_l1: null,
    plate_digits: null,
    plate_l2: null,
    plate_region: null,
    vehicle_rental_id: null,
    vehicle_rental_expires_at: null,
    drivers_license: 0,
    driver_licenses: null,
    housing_type: null,
    housing_city_id: null,
    housing_expires_at: null,
    housing_owned_at: null,
    housing_property_id: null,
    housing_owned_id: null,
    housing_last_type: null,
    housing_last_city_id: null,
    housing_last_expires_at: null,
    housing_last_owned_id: null,
    housing_last_property_id: null,
    housing_stack: null,
    housing_pending_owned_id: null,
    energy: 80,
    hunger: 80,
    mood: 70,
    health: 100,
    reputation: 100,
    education: "none",
    ...partial,
  };
}

describe("simTariff", () => {
  it("Omsk vs Kazan weekly prices", () => {
    assert.equal(getWeeklyTariffPrice("minimal", "omsk"), 300);
    assert.equal(getWeeklyTariffPrice("unlimited", "omsk"), 1000);
    assert.equal(getWeeklyTariffPrice("unlimited", "kazan"), 1200);
  });

  it("prorate 3 days used leaves 4 remaining", () => {
    const now = 1000 + 3 * 86_400_000;
    const paidUntil = 1000 + SIM_TARIFF_WEEK_MS;
    const { daysUsed, daysRemaining } = prorateTariffDays(paidUntil, now);
    assert.equal(daysUsed, 3);
    assert.equal(daysRemaining, 4);
  });

  it("upgrade top-up after 3 days on minimal to unlimited in Omsk", () => {
    const now = 1000 + 3 * 86_400_000;
    const paidUntil = 1000 + SIM_TARIFF_WEEK_MS;
    const topUp = calcUpgradeTopUpRub("minimal", "unlimited", "omsk", paidUntil, now);
    assert.equal(topUp, 400);
  });

  it("renews from sim balance when period ended", () => {
    const now = 50_000;
    const patch = processSimTariffBilling(
      player({
        sim_tariff_id: "minimal",
        sim_tariff_paid_until: 1000,
        sim_balance_rub: 500,
        city_id: "omsk",
      }),
      now,
    );
    assert.equal(patch?.sim_balance_rub, 200);
    assert.equal(patch?.sim_tariff_paid_until, now + SIM_TARIFF_WEEK_MS);
  });

  it("applies pending downgrade at billing", () => {
    const now = 50_000;
    const patch = processSimTariffBilling(
      player({
        sim_tariff_id: "unlimited",
        sim_tariff_paid_until: 1000,
        sim_tariff_pending_id: "incoming_only",
        sim_balance_rub: 100,
      }),
      now,
    );
    assert.equal(patch?.sim_tariff_id, "incoming_only");
    assert.equal(patch?.sim_tariff_pending_id, null);
  });

  it("downgrades to incoming when balance insufficient", () => {
    const patch = processSimTariffBilling(
      player({
        sim_tariff_id: "unlimited",
        sim_tariff_paid_until: 1000,
        sim_balance_rub: 50,
      }),
      50_000,
    );
    assert.equal(patch?.sim_tariff_id, "incoming_only");
    assert.equal(patch?.sim_tariff_paid_until, null);
  });

  it("job requires unlimited tariff", () => {
    assert.equal(
      playerMeetsSimTariff(player({ sim_tariff_id: "connected" }), "unlimited"),
      false,
    );
    assert.equal(
      playerMeetsSimTariff(player({ sim_tariff_id: "unlimited" }), "unlimited"),
      true,
    );
  });
});
