import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CarModel } from "./gameData.js";
import { applyPercentModifier, newCarPriceModifier } from "./cityEffectModifiers.js";

const DATA_DIR = join(import.meta.dirname, "../../../data");

type CarMarketConfig = {
  cityMarketLevel: Record<string, number>;
  maxClassByMarketLevel: Record<string, string>;
  classOrder: string[];
  classLabels: Record<string, string>;
  maintenanceRatePctMonthly: Record<string, number>;
  cheapClasses: string[];
  expensiveClasses: string[];
  cheapPriceMultiplier: { min: number; max: number };
  midPriceMultiplier: { min: number; max: number };
  expensivePriceMultiplier: { min: number; max: number };
  maintenanceIntervalMs: number;
};

const market = JSON.parse(
  readFileSync(join(DATA_DIR, "carMarket.json"), "utf-8"),
) as CarMarketConfig;

export function getCityCarMarketLevel(cityId: string): number {
  return market.cityMarketLevel[cityId] ?? 1;
}

export function getMaxCarClassForMarketLevel(level: number): string {
  return market.maxClassByMarketLevel[String(level)] ?? "economy";
}

export function getCarClassLabel(carClass: string): string {
  return market.classLabels[carClass] ?? carClass;
}

export function getMaintenanceIntervalMs(): number {
  return market.maintenanceIntervalMs;
}

export function getMaintenanceRatePctMonthly(carClass: string): number {
  return market.maintenanceRatePctMonthly[carClass] ?? 0.007;
}

function classIndex(carClass: string): number {
  const i = market.classOrder.indexOf(carClass);
  return i >= 0 ? i : 0;
}

export function isCarClassAvailableInCity(cityId: string, carClass: string): boolean {
  const level = getCityCarMarketLevel(cityId);
  const maxClass = getMaxCarClassForMarketLevel(level);
  return classIndex(carClass) <= classIndex(maxClass);
}

/** Цены на авто одинаковые во всех городах; множители — только у недвижимости. */
export function getCarCityPriceMultiplier(_cityId: string, _car: CarModel): number {
  return 1;
}

export function getCarBasePriceRub(car: CarModel): number {
  return car.priceRub;
}

export function getCarCityPriceRub(cityId: string, car: CarModel, now = Date.now()): number {
  const base = Math.round(getCarBasePriceRub(car) * getCarCityPriceMultiplier(cityId, car));
  const mod = newCarPriceModifier(cityId, now);
  return applyPercentModifier(base, mod.totalPct);
}

export function getCarCityPriceHints(cityId: string, now = Date.now()): string[] {
  return newCarPriceModifier(cityId, now).hints;
}

export function getCarCityPriceRubById(cityId: string, carId: string, getCar: (id: string) => CarModel | undefined): number | null {
  const car = getCar(carId);
  if (!car) return null;
  if (!isCarClassAvailableInCity(cityId, car.carClass ?? "economy")) return null;
  return getCarCityPriceRub(cityId, car);
}
