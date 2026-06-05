import { formatRub } from "./formatRub.js";
import type { PlayerRow } from "./db.js";
import { getPlayer, updatePlayer } from "./db.js";
import { getCar } from "./gameData.js";
import { getMaintenanceIntervalMs } from "./carMarket.js";
import {
  getCarReliability,
  monthlyMaintenanceRub,
  reliabilityRepairExtraRub,
} from "./carStats.js";
import { appendPlayerFeed } from "./playerFeed.js";
import { listPlayerCars, type PlayerCarRow } from "./playerCars.js";

export function syncPlayerCarMaintenance(userId: number, now = Date.now()): PlayerRow | undefined {
  const player = getPlayer(userId);
  if (!player) return undefined;
  const cars = listPlayerCars(userId);
  if (cars.length === 0) return player;

  const oldestAcquired = Math.min(...cars.map((c) => c.acquired_at));
  const lastAt = player.last_car_maintenance_at ?? oldestAcquired;
  if (now - lastAt < getMaintenanceIntervalMs()) return player;

  let totalCharge = 0;
  const lines: string[] = [];

  for (const row of cars) {
    const charge = maintenanceChargeForCar(row);
    if (charge <= 0) continue;
    totalCharge += charge;
    const car = getCar(row.car_model_id);
    const name = car ? `${car.brand} ${car.model}` : row.car_model_id;
    lines.push(`${name}: ${formatRub(charge)}`);
  }

  if (totalCharge <= 0) {
    updatePlayer(userId, { last_car_maintenance_at: now });
    return getPlayer(userId) ?? player;
  }

  const rubles = Math.max(0, player.rubles - totalCharge);
  updatePlayer(userId, { rubles, last_car_maintenance_at: now });

  const summary =
    lines.length === 1
      ? `ТО: ${lines[0]}`
      : `ТО автомобилей (−${formatRub(totalCharge)})`;
  appendPlayerFeed(userId, "shop:car", summary, now);

  return getPlayer(userId) ?? player;
}

function maintenanceChargeForCar(row: PlayerCarRow & { purchase_price_rub?: number | null }): number {
  const car = getCar(row.car_model_id);
  if (!car) return 0;
  const price = row.purchase_price_rub ?? car.priceRub;
  const base = monthlyMaintenanceRub(car, price);
  const extra = reliabilityRepairExtraRub(car, base);
  return base + extra;
}
