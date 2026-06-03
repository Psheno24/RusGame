import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TaxiCarOption } from "./taxi.js";

/** Логика из getTaxiStatus: выбор считается активным только если авто в списке доступных. */
function carSelectedForStatus(
  state: { carSelected: boolean; carSource: string; carRefId: number } | null,
  cars: TaxiCarOption[],
): boolean {
  if (!state?.carSelected) return false;
  return cars.some((c) => c.source === state.carSource && c.refId === state.carRefId);
}

describe("taxi car selection status", () => {
  const rentalCar: TaxiCarOption = {
    source: "rental",
    refId: 0,
    modelId: "lada-granta",
    label: "Каршеринг",
    taxiClass: "economy",
    tariffTitle: "Эконом",
  };

  it("не считает выбранным авто, которого нет в availableCars", () => {
    const state = { carSelected: true, carSource: "rental", carRefId: 0 };
    assert.equal(carSelectedForStatus(state, []), false);
  });

  it("считает выбранным, если авто есть в списке", () => {
    const state = { carSelected: true, carSource: "rental", carRefId: 0 };
    assert.equal(carSelectedForStatus(state, [rentalCar]), true);
  });
});
