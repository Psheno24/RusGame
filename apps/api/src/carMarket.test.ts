import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getCarCityPriceMultiplier,
  getCarCityPriceRub,
  isCarClassAvailableInCity,
} from "./carMarket.js";
import { getCar } from "./gameData.js";

describe("carMarket", () => {
  it("Granta same price in Omsk and Moscow", () => {
    const car = getCar("lada-granta")!;
    const omsk = getCarCityPriceRub("omsk", car);
    const moscow = getCarCityPriceRub("moscow", car);
    assert.equal(omsk, moscow);
    assert.equal(omsk, car.priceRub);
  });

  it("S-Class same price in Omsk and Moscow", () => {
    const car = getCar("mercedes-s-class")!;
    const omsk = getCarCityPriceRub("omsk", car);
    const moscow = getCarCityPriceRub("moscow", car);
    assert.equal(omsk, moscow);
    assert.equal(moscow, car.priceRub);
  });

  it("premium sold in Moscow market", () => {
    assert.equal(isCarClassAvailableInCity("omsk", "premium"), false);
    assert.equal(isCarClassAvailableInCity("moscow", "premium"), true);
  });

  it("car price multiplier is always 1", () => {
    const car = getCar("lada-granta")!;
    assert.equal(getCarCityPriceMultiplier("moscow", car), 1);
    assert.equal(getCarCityPriceMultiplier("omsk", car), 1);
  });
});
