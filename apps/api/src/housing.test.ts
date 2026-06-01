import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlayerRow } from "./db.js";
import { isCityResident } from "./housing.js";

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
    car_owned: 0,
    plate_text: null,
    drivers_license: 0,
    housing_type: null,
    housing_city_id: null,
    housing_expires_at: null,
    energy: 80,
    hunger: 80,
    mood: 70,
    health: 100,
    reputation: 100,
    education: "none",
    ...partial,
  };
}

describe("housing", () => {
  const now = Date.now();

  it("guest without housing", () => {
    assert.equal(isCityResident(player({}), "omsk", now), false);
  });

  it("resident with active dorm in city", () => {
    assert.equal(
      isCityResident(
        player({
          housing_type: "dorm",
          housing_city_id: "omsk",
          housing_expires_at: now + 3600_000,
        }),
        "omsk",
        now,
      ),
      true,
    );
  });

  it("expired dorm is not resident", () => {
    assert.equal(
      isCityResident(
        player({
          housing_type: "dorm",
          housing_city_id: "omsk",
          housing_expires_at: now - 1,
        }),
        "omsk",
        now,
      ),
      false,
    );
  });

  it("owned in city is always resident", () => {
    assert.equal(
      isCityResident(
        player({
          housing_type: "owned",
          housing_city_id: "omsk",
          housing_expires_at: null,
        }),
        "omsk",
        now,
      ),
      true,
    );
  });

  it("housing in other city does not grant residency", () => {
    assert.equal(
      isCityResident(
        player({
          housing_type: "owned",
          housing_city_id: "kazan",
          housing_expires_at: null,
          city_id: "omsk",
        }),
        "omsk",
        now,
      ),
      false,
    );
  });
});
