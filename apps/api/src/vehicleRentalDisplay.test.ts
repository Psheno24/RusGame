import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlayerRow } from "./db.js";
import { buildVehicleRentalTimeInfo } from "./vehicleRentalDisplay.js";

function player(partial: Partial<PlayerRow>): PlayerRow {
  return {
    user_id: 1,
    display_name: "T",
    rubles: 1000,
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
    phone_number: "1",
    sim_operator: null,
    sim_mid: null,
    sim_last: null,
    sim_balance_rub: 0,
    sim_tariff_id: "unlimited",
    sim_tariff_paid_until: null,
    sim_tariff_pending_id: null,
    phone_device_id: null,
    phone_acquired_at: null,
    car_owned: 0,
    car_acquired_at: null,
    plate_text: null,
    drivers_license: 0,
    driver_licenses: null,
    housing_type: "dorm",
    housing_city_id: "omsk",
    housing_expires_at: null,
    housing_owned_at: null,
    car_model_id: null,
    plate_l1: null,
    plate_digits: null,
    plate_l2: null,
    plate_region: null,
    vehicle_rental_id: "car-economy",
    vehicle_rental_expires_at: 10_000,
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
    taxi_state: null,
    last_car_maintenance_at: null,
    sleep_started_at: null,
    sleep_planned_ms: null,
    sleep_start_energy: null,
    ...partial,
  };
}

describe("buildVehicleRentalTimeInfo", () => {
  it("shows remaining when active", () => {
    const now = 5_000;
    const info = buildVehicleRentalTimeInfo(
      player({ vehicle_rental_expires_at: now + 2 * 60 * 60 * 1000 }),
      now,
    );
    assert.ok(info);
    assert.equal(info.isActive, true);
    assert.ok(info.remainingLabel.startsWith("ещё"));
    assert.ok(info.cardRightSubtext.includes("Омск"));
  });

  it("shows expired when past expiresAt", () => {
    const now = 20_000;
    const info = buildVehicleRentalTimeInfo(player({ vehicle_rental_expires_at: 10_000 }), now);
    assert.ok(info);
    assert.equal(info.isActive, false);
    assert.equal(info.cardRightText, "истекла");
    assert.ok(info.remainingLabel.includes("истекла"));
  });
});
