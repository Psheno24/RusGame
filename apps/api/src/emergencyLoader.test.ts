import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlayerRow } from "./db.js";
import { dormDayPriceRub } from "./housing.js";
import {
  LOADER_COOLDOWN_MS,
  LOADER_JOB_ID,
  LOADER_PAYOUT_RUB,
  buildEmergencyLoaderBrief,
  buildEmergencyLoaderJob,
  playerEmployedAsLoader,
  shouldOfferEmergencyLoader,
  shiftsToAffordRub,
} from "./emergencyLoader.js";

function player(partial: Partial<PlayerRow> & Pick<PlayerRow, "city_id" | "rubles">): PlayerRow {
  return {
    user_id: 1,
    display_name: "Test",
    rubles: partial.rubles,
    city_id: partial.city_id,
    status: partial.status ?? "idle",
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
    energy: 80,
    hunger: 80,
    mood: 70,
    health: 100,
    reputation: 0,
    education: "none",
    taxi_state: null,
    last_car_maintenance_at: null,
    sleep_started_at: null,
    sleep_planned_ms: null,
    sleep_start_energy: null,
    ...partial,
  };
}

describe("emergencyLoader", () => {
  it("uses 30 min cooldown without shift hours", () => {
    const job = buildEmergencyLoaderJob("omsk");
    assert.equal(job.id, LOADER_JOB_ID);
    assert.equal(job.shiftHours, undefined);
    assert.equal(job.cooldownMs, LOADER_COOLDOWN_MS);
    assert.equal(job.payoutMin, LOADER_PAYOUT_RUB);
    assert.equal(job.payoutMax, LOADER_PAYOUT_RUB);
  });

  it("uses the same loader job id in every city", () => {
    assert.equal(buildEmergencyLoaderJob("moscow").id, LOADER_JOB_ID);
    assert.equal(buildEmergencyLoaderJob("voronezh").id, LOADER_JOB_ID);
  });

  it("offers loader when rubles below local dorm day price", () => {
    const dormRub = dormDayPriceRub("kazan");
    assert.ok(dormRub > 500);
    assert.equal(shouldOfferEmergencyLoader(player({ city_id: "kazan", rubles: dormRub - 1 })), true);
    assert.equal(shouldOfferEmergencyLoader(player({ city_id: "kazan", rubles: dormRub })), false);
  });

  it("builds brief with need rub and travel advice when relocation is cheaper", () => {
    const brief = buildEmergencyLoaderBrief(player({ city_id: "moscow", rubles: 100 }));
    assert.ok(brief);
    assert.ok(brief.dormDayRub > 1000);
    assert.equal(brief.needRub, brief.dormDayRub - 100);
    assert.ok(brief.shiftsToDorm >= 1);
    if (brief.travelAdvice) {
      assert.ok(brief.travelAdvice.totalRub < brief.needRub);
      assert.equal(brief.travelAdvice.savingsRub, brief.needRub - brief.travelAdvice.totalRub);
    }
  });

  it("hides travel advice when local top-up is cheaper than relocation", () => {
    const dormRub = dormDayPriceRub("moscow");
    const brief = buildEmergencyLoaderBrief(player({ city_id: "moscow", rubles: dormRub - 1000 }));
    assert.ok(brief);
    assert.equal(brief.needRub, 1000);
    assert.equal(brief.travelAdvice, null);
  });

  it("shiftsToAffordRub rounds up", () => {
    assert.equal(shiftsToAffordRub(0), 0);
    assert.equal(shiftsToAffordRub(1), 1);
    assert.equal(shiftsToAffordRub(500), 1);
    assert.equal(shiftsToAffordRub(501), 2);
  });

  it("treats legacy and global loader job ids as the same employment", () => {
    assert.equal(
      playerEmployedAsLoader(player({ city_id: "moscow", rubles: 0, job_id: "moscow_loader" })),
      true,
    );
    assert.equal(
      playerEmployedAsLoader(player({ city_id: "voronezh", rubles: 0, job_id: LOADER_JOB_ID })),
      true,
    );
    assert.equal(
      playerEmployedAsLoader(player({ city_id: "moscow", rubles: 0, job_id: "moscow_delivery" })),
      false,
    );
  });
});
