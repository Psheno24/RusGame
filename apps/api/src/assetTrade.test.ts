import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeResaleValue,
  formatMarketLossLossLine,
  housingTradeInRateHint,
} from "./assetTrade.js";

const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;

describe("assetTrade", () => {
  const now = Date.now();

  it("uses catalog price as base (not purchase price)", () => {
    const catalogToday = 15000;
    assert.equal(computeResaleValue(catalogToday, "phone", now, now, "sell"), 9000);
  });

  it("phone trade-in 60% before 30 days", () => {
    assert.equal(computeResaleValue(10000, "phone", now - MS_30_DAYS + 1, now, "trade_in"), 6000);
  });

  it("phone trade-in 120% after 30 days", () => {
    assert.equal(computeResaleValue(10000, "phone", now - MS_30_DAYS, now, "trade_in"), 12000);
  });

  it("phone sell always 60%", () => {
    assert.equal(computeResaleValue(10000, "phone", now - MS_30_DAYS * 2, now, "sell"), 6000);
  });

  it("car trade-in 80%", () => {
    assert.equal(computeResaleValue(100000, "car", now, now, "trade_in"), 80000);
  });

  it("car sell 80%", () => {
    assert.equal(computeResaleValue(100000, "car", now, now, "sell"), 80000);
  });

  it("housing trade-in 90%", () => {
    assert.equal(computeResaleValue(1000000, "housing", now, now, "trade_in"), 900000);
  });

  it("housing sell 60%", () => {
    assert.equal(computeResaleValue(1000000, "housing", now - MS_30_DAYS * 2, now, "sell"), 600000);
  });

  it("housing trade-in 120% after 30 days", () => {
    assert.equal(
      computeResaleValue(1000000, "housing", now - MS_30_DAYS, now, "trade_in"),
      1200000,
    );
  });

  it("housingTradeInRateHint by ownership duration", () => {
    assert.match(housingTradeInRateHint(now, now), /90%.*владели меньше 30/);
    assert.match(
      housingTradeInRateHint(now - MS_30_DAYS, now),
      /120%.*владели больше 30/,
    );
  });

  it("formatMarketLossLossLine for 60% sell", () => {
    assert.equal(
      formatMarketLossLossLine(12_000_000, 7_200_000),
      "40% от текущей стоимости на рынке (4 800 000 ₽)",
    );
  });
});
