import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ensureCityUsedMarket,
  generateCityListings,
  getMaxUsedCarClassForCity,
  getMileageWearMultiplier,
  isCarClassOnUsedMarket,
  buildDiagnosisRanges,
  listingDiagnoseCostRub,
} from "./usedCarMarket.js";
import { isCarClassAvailableInCity } from "./carMarket.js";

describe("usedCarMarket", () => {
  it("used market allows two classes above salon max in Omsk", () => {
    assert.equal(isCarClassAvailableInCity("omsk", "economy"), true);
    assert.equal(isCarClassAvailableInCity("omsk", "comfort"), false);
    assert.equal(isCarClassOnUsedMarket("omsk", "economy"), true);
    assert.equal(isCarClassOnUsedMarket("omsk", "comfort"), true);
    assert.equal(isCarClassOnUsedMarket("omsk", "comfort_plus"), true);
    assert.equal(isCarClassOnUsedMarket("omsk", "business"), false);
    assert.equal(getMaxUsedCarClassForCity("omsk"), "comfort_plus");
  });

  it("Samara salon comfort+ and used up to premium", () => {
    assert.equal(isCarClassAvailableInCity("samara", "comfort_plus"), true);
    assert.equal(isCarClassOnUsedMarket("samara", "premium"), true);
    assert.equal(isCarClassOnUsedMarket("samara", "luxury"), false);
  });

  it("diagnose cost is stable per listing id", () => {
    const listing = {
      id: "omsk-123-0",
      carModelId: "lada_granta",
      mileageKm: 50_000,
      condition: {
        engine: 80,
        transmission: 75,
        tires: 70,
        alignment: 68,
        body: 85,
        electronics: 72,
        interior: 78,
      },
      overallVisible: 82,
      priceRub: 600_000,
      newPriceRub: 900_000,
    };
    const a = listingDiagnoseCostRub(listing);
    const b = listingDiagnoseCostRub(listing);
    assert.equal(a, b);
    assert.ok(a >= 500);
  });

  it("generates stable listing count for Omsk in a refresh slot", () => {
    const refreshedAt = 2_880_000_000;
    const a = generateCityListings("omsk", refreshedAt);
    const b = generateCityListings("omsk", refreshedAt);
    assert.equal(a.length, b.length);
    assert.ok(a.length >= 5 && a.length <= 7);
    assert.ok(a.every((l) => l.priceRub > 0 && l.mileageKm >= 0));
  });

  it("Moscow used market has more listings than Omsk", () => {
    const slot = 2_880_000_000;
    const omsk = generateCityListings("omsk", slot).length;
    const moscow = generateCityListings("moscow", slot).length;
    assert.ok(moscow >= omsk);
    assert.ok(moscow >= 12 && moscow <= 15);
  });

  it("mileage wear multiplier tiers", () => {
    assert.equal(getMileageWearMultiplier(10_000), 1);
    assert.equal(getMileageWearMultiplier(80_000), 1.2);
    assert.equal(getMileageWearMultiplier(200_000), 1.5);
    assert.equal(getMileageWearMultiplier(400_000), 1.8);
  });

  it("diagnosis ranges contain actual values", () => {
    const condition = {
      engine: 78,
      transmission: 70,
      tires: 64,
      alignment: 61,
      body: 82,
      electronics: 55,
      interior: 71,
    };
    const ranges = buildDiagnosisRanges(condition, () => 0.1);
    assert.ok(ranges.engine.min <= condition.engine && ranges.engine.max >= condition.engine);
    assert.ok(ranges.tires.min <= condition.tires);
    assert.ok(ranges.alignment.min <= condition.alignment);
  });

  it("ensureCityUsedMarket persists listings", () => {
    const market = ensureCityUsedMarket("kazan", Date.now());
    assert.ok(market.listings.length >= 8);
    assert.ok(market.nextRefreshAt > market.refreshedAt);
  });
});
