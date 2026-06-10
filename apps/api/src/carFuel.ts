import { getBalanceBible } from "./balanceBible.js";
import { applyPercentModifier, fuelPriceModifier } from "./cityEffectModifiers.js";
import { getCar, type CarModel } from "./gameData.js";
import { getDb } from "./db.js";
import { getPlayerCarById, type PlayerCarRow } from "./playerCars.js";

export type FuelType = "ai92" | "ai95" | "premium";

export function getCarTankLiters(car: CarModel): number {
  const raw = car as CarModel & { fuelTankL?: number };
  return raw.fuelTankL ?? 50;
}

export function getCarConsumptionL100(car: CarModel): number {
  const raw = car as CarModel & { fuelConsumptionL100?: number };
  return raw.fuelConsumptionL100 ?? car.fuelConsumption ?? 7;
}

export function fuelPriceRub(type: FuelType, cityId?: string, now = Date.now()): number {
  const f = getBalanceBible().fuel;
  const base = f[type] ?? 70;
  if (!cityId) return base;
  const mod = fuelPriceModifier(cityId, now);
  return applyPercentModifier(base, mod.totalPct);
}

export function fuelPriceHints(cityId: string, now = Date.now()): string[] {
  return fuelPriceModifier(cityId, now).hints;
}

export function getFuelLevelLiters(row: PlayerCarRow, car: CarModel): number {
  const tank = getCarTankLiters(car);
  const stored = (row as PlayerCarRow & { fuel_level_l?: number | null }).fuel_level_l;
  if (stored == null || stored < 0) return tank;
  return Math.min(tank, Math.max(0, stored));
}

export function setFuelLevelLiters(userId: number, playerCarId: number, liters: number) {
  getDb()
    .prepare("UPDATE player_cars SET fuel_level_l = ? WHERE user_id = ? AND id = ?")
    .run(Math.max(0, Math.round(liters * 10) / 10), userId, playerCarId);
}

export function consumeFuelLiters(
  userId: number,
  playerCarId: number,
  distanceKm: number,
): boolean {
  const row = getPlayerCarById(userId, playerCarId);
  if (!row) return false;
  const car = getCar(row.car_model_id);
  if (!car) return false;
  const consumption = getCarConsumptionL100(car);
  const used = (distanceKm * consumption) / 100;
  const current = getFuelLevelLiters(row, car);
  if (current < used) {
    setFuelLevelLiters(userId, playerCarId, 0);
    return false;
  }
  setFuelLevelLiters(userId, playerCarId, current - used);
  return true;
}

export function recommendedFuelType(car: CarModel): FuelType {
  const cls = car.carClass ?? "economy";
  if (cls === "premium" || cls === "business") return "premium";
  if (cls === "comfort_plus" || cls === "comfort") return "ai95";
  return "ai92";
}
