import { getBalanceBible } from "./balanceBible.js";
import { getCar } from "./gameData.js";
import {
  getPlayerCarById,
  getPlayerCarCondition,
  updatePlayerCarCondition,
  type PlayerCarCondition,
  type PlayerCarRow,
} from "./playerCars.js";
import { getDb } from "./db.js";

/** Узлы износа по библии → поля состояния авто. */
const BIBLE_WEAR_NODES: { bible: string; cond: keyof PlayerCarCondition }[] = [
  { bible: "engine", cond: "engine" },
  { bible: "transmission", cond: "transmission" },
  { bible: "suspension", cond: "alignment" },
  { bible: "brakes", cond: "electronics" },
  { bible: "tires", cond: "tires" },
  { bible: "body", cond: "body" },
];

function mileageWearMult(km: number): number {
  let mult = 1;
  for (const step of getBalanceBible().wearMileageMult) {
    if (km >= step.fromKm) mult = step.mult;
  }
  return mult;
}

function wearPctForClass(carClass: string): number {
  const map = getBalanceBible().wearPctPer100Km;
  return map[carClass] ?? map.economy ?? 0.8;
}

export function applyDrivingWear(
  userId: number,
  playerCarId: number,
  distanceKm: number,
): void {
  if (distanceKm <= 0) return;
  const row = getPlayerCarById(userId, playerCarId);
  if (!row) return;
  const car = getCar(row.car_model_id);
  if (!car) return;

  const totalKm = (row.mileage_km ?? 0) + Math.round(distanceKm * 10) / 10;
  const basePct = wearPctForClass(car.carClass ?? "economy");
  const mult = mileageWearMult(totalKm);
  const lossPer100 = basePct * mult * (distanceKm / 100);

  const condition = getPlayerCarCondition(row);
  for (const { cond } of BIBLE_WEAR_NODES) {
    const variance = 0.85 + Math.random() * 0.3;
    condition[cond] = Math.max(0, Math.round(condition[cond] - lossPer100 * variance));
  }

  getDb()
    .prepare(
      `UPDATE player_cars SET mileage_km = ?, is_used = 1,
         cond_engine = ?, cond_transmission = ?, cond_tires = ?, cond_alignment = ?,
         cond_body = ?, cond_electronics = ?, cond_interior = ?
       WHERE user_id = ? AND id = ?`,
    )
    .run(
      Math.round(totalKm),
      condition.engine,
      condition.transmission,
      condition.tires,
      condition.alignment,
      condition.body,
      condition.electronics,
      condition.interior,
      userId,
      playerCarId,
    );
}

export function resolveTaxiPlayerCarId(
  userId: number,
  carSource: "owned" | "rental",
  carRefId: number,
): number | null {
  if (carSource !== "owned") return null;
  const row = getPlayerCarById(userId, carRefId);
  return row?.id ?? null;
}
