import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlayerRow } from "./db.js";
import { effectiveMood, housingMoodBonusForPlayer } from "./housingMood.js";

function player(partial: Partial<PlayerRow> = {}): PlayerRow {
  const now = Date.now();
  return {
    user_id: 1,
    display_name: "t",
    rubles: 5000,
    city_id: "omsk",
    status: "idle",
    travel_to_city_id: null,
    travel_arrives_at: null,
    job_id: null,
    driving: 0,
    stamina: 0,
    charisma: 0,
    discipline: 0,
    skill_progress: null,
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
    housing_type: "dorm",
    housing_city_id: "omsk",
    housing_expires_at: now + 86400000,
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
    mood: 0,
    health: 100,
    reputation: 0,
    education: "none",
    education_ends_at: null,
    days_played: 0,
    career_level: "none",
    delivery_state: null,
    taxi_state: null,
    last_car_maintenance_at: null,
    sleep_started_at: null,
    sleep_planned_ms: null,
    sleep_start_energy: null,
    ...partial,
  };
}

describe("housingMood", () => {
  it("starter Omsk dorm: tier -20 and dorm -10", () => {
    const p = player();
    assert.equal(housingMoodBonusForPlayer(p), -10);
    assert.equal(effectiveMood(p), -30);
  });

  it("expired dorm gives no housing mood bonus", () => {
    const p = player({ housing_expires_at: Date.now() - 1000 });
    assert.equal(housingMoodBonusForPlayer(p), 0);
    assert.equal(effectiveMood(p), -20);
  });

  it("moscow tier 5 adds +20 city mood", () => {
    const p = player({ city_id: "moscow" });
    assert.equal(effectiveMood(p), 10);
  });
});
