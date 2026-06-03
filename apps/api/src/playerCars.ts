import type { PlayerRow } from "./db.js";
import { getDb, getPlayer, updatePlayer } from "./db.js";
import { getCar, getCars } from "./gameData.js";
import { computeResaleValue } from "./assetTrade.js";
import { getCarShopPriceRub } from "./shopCatalog.js";
import { getCarCooldownReducePct, getCarSpeed } from "./carStats.js";

export type PlayerCarCondition = {
  engine: number;
  transmission: number;
  tires: number;
  alignment: number;
  body: number;
  electronics: number;
  interior: number;
};

export type PlayerCarRow = {
  id: number;
  user_id: number;
  car_model_id: string;
  acquired_at: number;
  purchase_price_rub: number | null;
  plate_text: string | null;
  plate_l1: string | null;
  plate_digits: string | null;
  plate_l2: string | null;
  plate_region: string | null;
  mileage_km?: number | null;
  is_used?: number | null;
  cond_engine?: number | null;
  cond_transmission?: number | null;
  cond_suspension?: number | null;
  cond_tires?: number | null;
  cond_alignment?: number | null;
  cond_body?: number | null;
  cond_electronics?: number | null;
  cond_interior?: number | null;
};

export function listPlayerCars(userId: number): PlayerCarRow[] {
  return getDb()
    .prepare(
      `SELECT id, user_id, car_model_id, acquired_at, purchase_price_rub, plate_text, plate_l1, plate_digits, plate_l2, plate_region,
              mileage_km, is_used, cond_engine, cond_transmission, cond_suspension, cond_tires, cond_alignment,
              cond_body, cond_electronics, cond_interior
       FROM player_cars WHERE user_id = ? ORDER BY acquired_at ASC`,
    )
    .all(userId) as PlayerCarRow[];
}

export function getPlayerCarById(userId: number, playerCarId: number): PlayerCarRow | undefined {
  return getDb()
    .prepare(
      `SELECT id, user_id, car_model_id, acquired_at, purchase_price_rub, plate_text, plate_l1, plate_digits, plate_l2, plate_region,
              mileage_km, is_used, cond_engine, cond_transmission, cond_suspension, cond_tires, cond_alignment,
              cond_body, cond_electronics, cond_interior
       FROM player_cars WHERE user_id = ? AND id = ?`,
    )
    .get(userId, playerCarId) as PlayerCarRow | undefined;
}

export function insertPlayerCar(
  userId: number,
  carModelId: string,
  acquiredAt: number,
  purchasePriceRub: number,
  plate?: Partial<
    Pick<PlayerCarRow, "plate_text" | "plate_l1" | "plate_digits" | "plate_l2" | "plate_region">
  >,
): number {
  const r = getDb()
    .prepare(
      `INSERT INTO player_cars (user_id, car_model_id, acquired_at, purchase_price_rub, plate_text, plate_l1, plate_digits, plate_l2, plate_region, mileage_km, is_used)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
    )
    .run(
      userId,
      carModelId,
      acquiredAt,
      purchasePriceRub,
      plate?.plate_text ?? null,
      plate?.plate_l1 ?? null,
      plate?.plate_digits ?? null,
      plate?.plate_l2 ?? null,
      plate?.plate_region ?? null,
    );
  syncPlayerCarSummary(userId);
  return Number(r.lastInsertRowid);
}

const FULL_CONDITION = 100;

export function getPlayerCarCondition(row: PlayerCarRow): PlayerCarCondition {
  if (!row.is_used) {
    return {
      engine: FULL_CONDITION,
      transmission: FULL_CONDITION,
      tires: FULL_CONDITION,
      alignment: FULL_CONDITION,
      body: FULL_CONDITION,
      electronics: FULL_CONDITION,
      interior: FULL_CONDITION,
    };
  }
  return {
    engine: row.cond_engine ?? FULL_CONDITION,
    transmission: row.cond_transmission ?? FULL_CONDITION,
    tires: row.cond_tires ?? row.cond_suspension ?? FULL_CONDITION,
    alignment: row.cond_alignment ?? row.cond_suspension ?? FULL_CONDITION,
    body: row.cond_body ?? FULL_CONDITION,
    electronics: row.cond_electronics ?? FULL_CONDITION,
    interior: row.cond_interior ?? FULL_CONDITION,
  };
}

export function updatePlayerCarCondition(
  userId: number,
  playerCarId: number,
  condition: PlayerCarCondition,
) {
  getDb()
    .prepare(
      `UPDATE player_cars SET
         cond_engine = ?, cond_transmission = ?, cond_tires = ?, cond_alignment = ?,
         cond_body = ?, cond_electronics = ?, cond_interior = ?
       WHERE user_id = ? AND id = ?`,
    )
    .run(
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

export function insertUsedPlayerCar(
  userId: number,
  carModelId: string,
  acquiredAt: number,
  purchasePriceRub: number,
  mileageKm: number,
  condition: PlayerCarCondition,
): number {
  const r = getDb()
    .prepare(
      `INSERT INTO player_cars (
         user_id, car_model_id, acquired_at, purchase_price_rub,
         plate_text, plate_l1, plate_digits, plate_l2, plate_region,
         mileage_km, is_used,
         cond_engine, cond_transmission, cond_tires, cond_alignment, cond_body, cond_electronics, cond_interior
       ) VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      userId,
      carModelId,
      acquiredAt,
      purchasePriceRub,
      mileageKm,
      condition.engine,
      condition.transmission,
      condition.tires,
      condition.alignment,
      condition.body,
      condition.electronics,
      condition.interior,
    );
  syncPlayerCarSummary(userId);
  return Number(r.lastInsertRowid);
}

export function deletePlayerCars(userId: number, playerCarIds: number[]) {
  if (playerCarIds.length === 0) return;
  const placeholders = playerCarIds.map(() => "?").join(",");
  getDb()
    .prepare(`DELETE FROM player_cars WHERE user_id = ? AND id IN (${placeholders})`)
    .run(userId, ...playerCarIds);
  syncPlayerCarSummary(userId);
}

export function playerHasAnyCar(userId: number): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM player_cars WHERE user_id = ? LIMIT 1")
    .get(userId);
  return Boolean(row);
}

export function parseDriverLicenses(player: PlayerRow): string[] {
  const raw = (player as PlayerRow & { driver_licenses?: string | null }).driver_licenses;
  if (!raw) {
    return player.drivers_license ? ["B"] : [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return player.drivers_license ? ["B"] : [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return player.drivers_license ? ["B"] : [];
  }
}

export function hasDriverLicense(player: PlayerRow, category: string): boolean {
  return parseDriverLicenses(player).includes(category);
}

export function addDriverLicense(userId: number, category: string) {
  const player = getPlayer(userId);
  if (!player) return;
  const cur = parseDriverLicenses(player);
  if (cur.includes(category)) return;
  const next = [...cur, category].sort();
  updatePlayer(userId, {
    driver_licenses: JSON.stringify(next),
    drivers_license: 1,
  } as Partial<PlayerRow>);
}

export function getBestCarCooldownReducePct(userId: number): number {
  let best = 0;
  for (const row of listPlayerCars(userId)) {
    const car = getCar(row.car_model_id);
    if (!car) continue;
    const pct = getCarCooldownReducePct(car);
    if (pct > best) best = pct;
  }
  return best;
}

export function applyCarCooldownReduction(userId: number, baseMs: number): number {
  const pct = getBestCarCooldownReducePct(userId);
  if (pct <= 0 || baseMs <= 0) return baseMs;
  return Math.max(0, Math.floor(baseMs * (1 - pct / 100)));
}

export function syncPlayerCarSummary(userId: number) {
  const player = getPlayer(userId);
  if (!player) return;
  const cars = listPlayerCars(userId);
  if (cars.length === 0) {
    updatePlayer(userId, {
      car_owned: 0,
      car_model_id: null,
      car_acquired_at: null,
      plate_text: null,
      plate_l1: null,
      plate_digits: null,
      plate_l2: null,
      plate_region: null,
    });
    return;
  }
  let best = cars[0];
  let bestSpeed = getCarSpeed(getCar(best.car_model_id) ?? { speed: 0 } as never);
  for (const c of cars) {
    const car = getCar(c.car_model_id);
    const spd = car ? getCarSpeed(car) : 0;
    if (spd > bestSpeed) {
      best = c;
      bestSpeed = spd;
    }
  }
  const withPlate = cars.find((c) => c.plate_text) ?? best;
  updatePlayer(userId, {
    car_owned: 1,
    car_model_id: best.car_model_id,
    car_acquired_at: best.acquired_at,
    plate_text: withPlate.plate_text,
    plate_l1: withPlate.plate_l1,
    plate_digits: withPlate.plate_digits,
    plate_l2: withPlate.plate_l2,
    plate_region: withPlate.plate_region,
  });
}

export function tradeInValueForPlayerCar(
  row: PlayerCarRow,
  cityId: string,
  now = Date.now(),
): number | null {
  const catalogPriceRub =
    row.purchase_price_rub ?? getCarShopPriceRub(row.car_model_id, cityId);
  if (catalogPriceRub == null) return null;
  return computeResaleValue(catalogPriceRub, "car", row.acquired_at, now, "trade_in");
}
