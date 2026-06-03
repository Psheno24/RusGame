import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ensureCityUsedMarket,
  generateCityListings,
  getMaxUsedCarClassForCity,
  getMileageWearMultiplier,
  isCarClassOnUsedMarket,
  buildDiagnosisRanges,
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

  it("generates stable listing count for Omsk in a refresh slot", () => {
    const refreshedAt = 2_880_000_000;
    const a = generateCityListings("omsk", refreshedAt);
    const b = generateCityListings("omsk", refreshedAt);
    assert.equal(a.length, b.length);
    assert.ok(a.length >= 5 && a.length <= 7);
    assert.ok(a.every((l) => l.priceRub > 0 && l.mileageKm >= 0));
  });

  it("Omsk used VAZ and Granta respect catalog price bands", () => {
    const bands: Record<string, [number, number]> = {
      "vaz-2114": [55_000, 200_000],
      "lada-granta": [90_000, 330_000],
      "renault-logan": [110_000, 385_000],
      "kia-rio": [180_000, 550_000],
    };
    for (let i = 0; i < 24; i++) {
      const listings = generateCityListings("omsk", i * 2_880_000_000);
      for (const l of listings) {
        const band = bands[l.carModelId];
        if (!band) continue;
        assert.ok(l.priceRub >= band[0], `${l.carModelId} ${l.priceRub}`);
        assert.ok(l.priceRub <= band[1], `${l.carModelId} ${l.priceRub}`);
      }
    }
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
