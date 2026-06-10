import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  capTripByMaxMinutes,
  rollDeliverySpeedMinPerKm,
  rollUniformSpeedMinPerKm,
} from "./lineTripSpeed.js";

const TRAFFIC = {
  free: { weight: 0.15, speedMinPerKm: 1.8, speedMaxPerKm: 2.4 },
  normal: { weight: 0.58, speedMinPerKm: 2.5, speedMaxPerKm: 3.5 },
  jam: { weight: 0.27, speedMinPerKm: 3.8, speedMaxPerKm: 5.5 },
};

describe("lineTripSpeed", () => {
  it("uniform speed stays in range", () => {
    for (let i = 0; i < 100; i++) {
      const s = rollUniformSpeedMinPerKm(7, 11);
      assert.ok(s >= 7 && s <= 11);
    }
  });

  it("walk delivery has no traffic title", () => {
    const r = rollDeliverySpeedMinPerKm("walk", 7, 11, TRAFFIC, "omsk");
    assert.equal(r.trafficTitle, undefined);
  });

  it("car delivery rolls traffic", () => {
    let withTraffic = 0;
    for (let i = 0; i < 50; i++) {
      const r = rollDeliverySpeedMinPerKm("car", 2, 3.5, TRAFFIC, "omsk");
      if (r.trafficTitle) withTraffic++;
      assert.ok(r.minPerKm >= 1.5 && r.minPerKm <= 8);
    }
    assert.ok(withTraffic > 40);
  });

  it("capTripByMaxMinutes shortens distance", () => {
    const capped = capTripByMaxMinutes(30, 90, 45);
    assert.equal(capped.tripMinutes, 45);
    assert.ok(capped.distanceKm < 30);
  });
});
