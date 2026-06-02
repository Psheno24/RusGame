import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getCarCityPriceMultiplier,
  getCarCityPriceRub,
  isCarClassAvailableInCity,
} from "./carMarket.js";
import { getCar } from "./gameData.js";

describe("carMarket", () => {
  it("Granta cheaper in Omsk than Moscow", () => {
    const car = getCar("lada-granta")!;
    const omsk = getCarCityPriceRub("omsk", car);
    const moscow = getCarCityPriceRub("moscow", car);
    assert.ok(omsk < moscow);
    assert.ok(omsk >= car.priceRub * 0.94);
  });

  it("S-Class more expensive in Omsk than Moscow", () => {
    const car = getCar("mercedes-s-class")!;
    const omsk = getCarCityPriceRub("omsk", car);
    const moscow = getCarCityPriceRub("moscow", car);
    assert.ok(omsk > moscow);
    assert.ok(omsk >= car.priceRub * 1.35);
  });

  it("hypercar not sold in Omsk market", () => {
    assert.equal(isCarClassAvailableInCity("omsk", "hypercar"), false);
    assert.equal(isCarClassAvailableInCity("moscow", "hypercar"), true);
  });

  it("Moscow multiplier is 1.0", () => {
    const car = getCar("bmw-m5")!;
    assert.equal(getCarCityPriceMultiplier("moscow", car), 1);
  });
});
