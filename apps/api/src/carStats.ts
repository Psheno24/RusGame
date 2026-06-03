import type { CarModel } from "./gameData.js";
import { getMaintenanceRatePctMonthly } from "./carMarket.js";

const SPEED_COOLDOWN_MAX_PCT = 25;

/** Снижение КД доставки: скорость 20 → 5%, 100 → 25%. */
export function speedToCooldownReducePct(speed: number): number {
  const s = Math.max(0, Math.min(100, speed));
  return Math.min(SPEED_COOLDOWN_MAX_PCT, Math.round((s * SPEED_COOLDOWN_MAX_PCT) / 100));
}

export function getCarSpeed(car: CarModel): number {
  if (car.speed != null) return car.speed;
  return (car.cooldownReducePct ?? 0) * 4;
}

export function getCarCooldownReducePct(car: CarModel): number {
  return speedToCooldownReducePct(getCarSpeed(car));
}

import { comfortToTaxiTariff } from "./taxiTariff.js";

export function getCarComfort(car: CarModel): number {
  return car.comfort ?? 20;
}

/** Максимальный тариф заказов, доступных этому авто (по комфорту). */
export function taxiClassForCarModel(car: CarModel): string {
  return comfortToTaxiTariff(getCarComfort(car));
}

/** @deprecated use comfortToTaxiTariff */
export function comfortToTaxiClass(comfort: number): string {
  return comfortToTaxiTariff(comfort);
}

/** Бонус настроения от престижа: 10→0, 50→2, 80→5, 100→10. */
export function prestigeToMoodBonus(prestige: number): number {
  const p = Math.max(0, Math.min(100, prestige));
  if (p <= 10) return 0;
  if (p <= 50) return Math.round(((p - 10) * 2) / 40);
  if (p <= 80) return 2 + Math.round(((p - 50) * 3) / 30);
  return 5 + Math.round(((p - 80) * 5) / 20);
}

export function getCarPrestige(car: CarModel): number {
  return car.prestige ?? 10;
}

export function getCarReliability(car: CarModel): number {
  return car.reliability ?? 50;
}

/** Ежемесячное обслуживание по цене покупки в городе. */
export function monthlyMaintenanceRub(car: CarModel, purchasePriceRub: number): number {
  const rate = getMaintenanceRatePctMonthly(car.carClass ?? "economy");
  return Math.max(500, Math.round(purchasePriceRub * rate));
}

/** Доп. расход при низкой надёжности (раз в цикл ТО). */
export function reliabilityRepairExtraRub(car: CarModel, baseMaintenanceRub: number): number {
  const rel = getCarReliability(car);
  if (rel >= 70) return 0;
  const factor = (70 - rel) / 70;
  return Math.round(baseMaintenanceRub * factor * 0.5);
}
