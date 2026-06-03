import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlayerRow } from "./db.js";
import {
  getCitySalaryMultiplier,
  skillPayoutMultiplier,
  applyCitySalaryToTemplate,
} from "./jobSalaries.js";
import { getCityJobs } from "./gameData.js";

function player(partial: Partial<PlayerRow>): PlayerRow {
  return {
    user_id: 1,
    display_name: "T",
    rubles: 0,
    city_id: "omsk",
    status: "idle",
    travel_to_city_id: null,
    travel_arrives_at: null,
    job_id: null,
    agility: 25,
    stamina: 25,
    charisma: 25,
    wit: 25,
    side_gig_ready_at: 0,
    shift_ready_at: 0,
    last_work_at_by_job: null,
    phone_number: null,
    sim_operator: null,
    sim_mid: null,
    sim_last: null,
    sim_balance_rub: 0,
    sim_tariff_id: "incoming_only",
    sim_tariff_paid_until: null,
    sim_tariff_pending_id: null,
    phone_device_id: null,
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
    taxi_state: null,
    last_car_maintenance_at: null,
    sleep_started_at: null,
    sleep_planned_ms: null,
    sleep_start_energy: null,
    energy: 80,
    hunger: 80,
    mood: 70,
    health: 100,
    reputation: 100,
    education: "none",
    ...partial,
  };
}

describe("jobSalaries", () => {
  it("moscow multiplier is 4", () => {
    assert.equal(getCitySalaryMultiplier("moscow"), 4);
  });

  it("moscow courier payout is 24000 base range", () => {
    const job = getCityJobs("moscow").find((j) => j.templateKey === "delivery");
    assert.ok(job);
    assert.equal(job!.payoutMin, 22_800);
    assert.equal(job!.payoutMax, 25_200);
  });

  it("skill at reference gives ~1.0 multiplier", () => {
    const mult = skillPayoutMultiplier(player({ stamina: 25, agility: 25 }), "delivery");
    assert.ok(mult >= 0.95 && mult <= 1.05);
  });

  it("low skills reduce payout up to 30%", () => {
    const mult = skillPayoutMultiplier(player({ stamina: 0, agility: 0 }), "delivery");
    assert.equal(mult, 0.7);
  });
});
