import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlayerRow } from "./db.js";
import { applyPostWorkPassives, scaleWorkCosts, workPayoutMultiplier } from "./playerStats.js";

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
    phone_number: null,
    sim_operator: null,
    sim_mid: null,
    sim_last: null,
    sim_balance_rub: 0,
    phone_device_id: null,
    phone_acquired_at: null,
    car_owned: 0,
    car_acquired_at: null,
    plate_text: null,
    drivers_license: 0,
    driver_licenses: null,
    housing_type: null,
    housing_city_id: null,
    housing_expires_at: null,
    housing_owned_at: null,
    car_model_id: null,
    plate_l1: null,
    plate_digits: null,
    plate_l2: null,
    plate_region: null,
    vehicle_rental_id: null,
    vehicle_rental_expires_at: null,
    housing_property_id: null,
    energy: 80,
    hunger: 80,
    mood: 70,
    health: 100,
    reputation: 100,
    education: "none",
    ...partial,
  };
}

describe("playerStats passives", () => {
  it("scaleWorkCosts adds energy when hungry", () => {
    const scaled = scaleWorkCosts(player({ hunger: 15 }), { energy: 12, hunger: 8 });
    assert.equal(scaled?.energy, 15);
  });

  it("scaleWorkCosts unchanged when fed", () => {
    const scaled = scaleWorkCosts(player({ hunger: 50 }), { energy: 12 });
    assert.equal(scaled?.energy, 12);
  });

  it("workPayoutMultiplier penalizes starving", () => {
    assert.equal(workPayoutMultiplier(player({ hunger: 5, energy: 80 })), 0.7);
  });

  it("applyPostWorkPassives drains health when very hungry", () => {
    const patch = applyPostWorkPassives(
      player({ hunger: 10, health: 100 }),
      { energy: 10, hunger: 2 },
    );
    assert.ok(patch.health != null && patch.health < 100);
  });
});
