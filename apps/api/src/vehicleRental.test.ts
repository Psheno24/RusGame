import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlayerRow } from "./db.js";
import { isVehicleRentalActive } from "./vehicleRental.js";

function player(partial: Partial<PlayerRow>): PlayerRow {
  return {
    user_id: 1,
    display_name: "T",
    rubles: 1000,
    city_id: "omsk",
    status: "idle",
    travel_to_city_id: null,
    travel_arrives_at: null,
    job_id: "taxi",
    driving: 0,
    stamina: 0,
    charisma: 0,
    discipline: 0,
    skill_progress: null,
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
    phone_device_id: "p",
    phone_acquired_at: null,
    car_owned: 0,
    car_acquired_at: null,
    plate_text: null,
    drivers_license: 1,
    driver_licenses: '["B"]',
    housing_type: "dorm",
    housing_city_id: "omsk",
    housing_expires_at: Date.now() + 999999,
    housing_owned_at: null,
    car_model_id: null,
    plate_l1: null,
    plate_digits: null,
    plate_l2: null,
    plate_region: null,
    vehicle_rental_id: "carshare-economy",
    vehicle_rental_expires_at: 1000,
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

describe("vehicleRental", () => {
  it("isVehicleRentalActive is false when expired", () => {
    assert.equal(
      isVehicleRentalActive(player({ vehicle_rental_expires_at: 1000 }), 2000),
      false,
    );
  });

  it("isVehicleRentalActive is true when not expired", () => {
    assert.equal(
      isVehicleRentalActive(player({ vehicle_rental_expires_at: 5000 }), 2000),
      true,
    );
  });
});
