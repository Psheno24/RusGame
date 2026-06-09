import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlayerRow } from "./db.js";
import {
  recordSkillAction,
  recordSkillActionForTemplate,
  SKILL_MAX,
  SKILL_PROGRESS_EVERY,
} from "./skills.js";

function player(partial: Partial<PlayerRow> = {}): PlayerRow {
  return {
    user_id: 1,
    display_name: "T",
    rubles: 0,
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
    reputation: 0,
    education: "none",
    ...partial,
  };
}

describe("skills", () => {
  it("grants driving after 10 taxi trips", () => {
    let p = player();
    for (let i = 1; i < SKILL_PROGRESS_EVERY; i++) {
      const r = recordSkillAction(p, "taxi_trips");
      p = { ...p, ...r.patch };
      assert.equal(r.granted, undefined);
    }
    const r = recordSkillAction(p, "taxi_trips");
    assert.equal(r.granted?.key, "driving");
    assert.equal(r.granted?.amount, 1);
    assert.equal(r.patch.driving, 1);
  });

  it("cashier shifts grant charisma every 10", () => {
    let p = player({ charisma: 99 });
    for (let i = 0; i < SKILL_PROGRESS_EVERY - 1; i++) {
      p = { ...p, ...recordSkillActionForTemplate(p, "cashier").patch };
    }
    const r = recordSkillActionForTemplate(p, "cashier");
    assert.equal(r.granted?.key, "charisma");
    assert.equal((r.patch.charisma ?? p.charisma), 100);
  });

  it("skills grow beyond 100 without cap", () => {
    const p = {
      ...player({ discipline: 100 }),
      skill_progress: JSON.stringify({ taxi_trips: 0, delivery: 0, cashier: 0, night_guard: 9 }),
    };
    const r = recordSkillActionForTemplate(p, "night_guard");
    assert.equal(r.granted?.key, "discipline");
    assert.equal(r.patch.discipline, 101);
  });
});
