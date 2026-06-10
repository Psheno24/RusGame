import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cashPaymentRiskChances,
  rollTaxiOrderTrip,
  rollTripMinutes,
  taxiKmPayoutRub,
  taxiTariffRatePerKm,
  tripHourlyRateRub,
  tripPayoutRub,
  type TaxiCashRiskConfig,
  type TaxiPayoutCurve,
} from "./taxiPayout.js";

const OMSK_CURVE: TaxiPayoutCurve = {
  tripMinutesMin: 5,
  tripMinutesMax: 45,
  midTripMinutes: 30,
  hourlyAtMinTrip: 8000,
  hourlyAtMidTrip: 5000,
  hourlyAtMaxTrip: 4000,
};

const CASH_CFG: TaxiCashRiskConfig = {
  cashNoPayBaseChance: 0.012,
  cashPartialPayBaseChance: 0.035,
  cashNoPayPerRatingBelow45: 0.006,
  cashPartialPayPerRatingBelow45: 0.01,
  cashPartialPayFraction: 0.6,
  parkCompensationFraction: 0.5,
};

describe("taxiPayout", () => {
  it("hourly rate anchors at 5, 30 and 45 minutes (legacy curve)", () => {
    assert.equal(tripHourlyRateRub(5, OMSK_CURVE), 8000);
    assert.equal(tripHourlyRateRub(30, OMSK_CURVE), 5000);
    assert.equal(tripHourlyRateRub(45, OMSK_CURVE), 4000);
  });

  it("trip payout matches hourly rate × duration (legacy)", () => {
    assert.equal(tripPayoutRub(5, OMSK_CURVE), 667);
    assert.equal(tripPayoutRub(30, OMSK_CURVE), 2500);
    assert.equal(tripPayoutRub(45, OMSK_CURVE), 3000);
  });

  it("rollTripMinutes stays within 5–45", () => {
    for (let i = 0; i < 200; i++) {
      const m = rollTripMinutes(OMSK_CURVE);
      assert.ok(m >= 5 && m <= 45);
    }
  });

  it("cash risk is rare and rises slightly for low passenger rating", () => {
    const good = cashPaymentRiskChances(4.8, CASH_CFG);
    const bad = cashPaymentRiskChances(3.1, CASH_CFG);
    assert.ok(good.noPayChance < 0.03);
    assert.ok(good.partialPayChance < 0.08);
    assert.ok(bad.noPayChance > good.noPayChance);
    assert.ok(bad.partialPayChance > good.partialPayChance);
    assert.ok(bad.noPayChance < 0.08);
  });

  it("economy Omsk base rate is 400 ₽/km", () => {
    assert.equal(taxiTariffRatePerKm("economy"), 400);
    assert.equal(taxiTariffRatePerKm("comfort"), 500);
  });

  it("rollTaxiOrderTrip derives time from km and caps at 45 min", () => {
    for (let i = 0; i < 200; i++) {
      const { tripMinutes, distanceKm } = rollTaxiOrderTrip("omsk");
      assert.ok(tripMinutes >= 3 && tripMinutes <= 45);
      assert.ok(distanceKm >= 0.5 && distanceKm <= 50);
    }
  });

  it("payout scales with city multiplier", () => {
    const omskPay = taxiKmPayoutRub(5, "economy", 1, 1);
    const moscowPay = taxiKmPayoutRub(5, "economy", 1, 4);
    assert.equal(omskPay, 5 * 400);
    assert.equal(moscowPay, omskPay * 4);
  });
});
