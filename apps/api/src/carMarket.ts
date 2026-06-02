import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CarModel } from "./gameData.js";

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

function marketTierT(cityId: string): number {
  const level = getCityCarMarketLevel(cityId);
  return (level - 1) / 6;
}

function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * t;
}

/** Множитель цены в городе (1.0 = базовая цена, как в Москве). */
export function getCarCityPriceMultiplier(cityId: string, car: CarModel): number {
  const t = marketTierT(cityId);
  const cls = car.carClass ?? "economy";
  if (market.cheapClasses.includes(cls)) {
    return lerp(market.cheapPriceMultiplier.min, market.cheapPriceMultiplier.max, t);
  }
  if (market.expensiveClasses.includes(cls)) {
    return lerp(market.expensivePriceMultiplier.min, market.expensivePriceMultiplier.max, t);
  }
  return lerp(market.midPriceMultiplier.min, market.midPriceMultiplier.max, t);
}

export function getCarBasePriceRub(car: CarModel): number {
  return car.priceRub;
}

export function getCarCityPriceRub(cityId: string, car: CarModel): number {
  return Math.round(getCarBasePriceRub(car) * getCarCityPriceMultiplier(cityId, car));
}

export function getCarCityPriceRubById(cityId: string, carId: string, getCar: (id: string) => CarModel | undefined): number | null {
  const car = getCar(carId);
  if (!car) return null;
  if (!isCarClassAvailableInCity(cityId, car.carClass ?? "economy")) return null;
  return getCarCityPriceRub(cityId, car);
}
