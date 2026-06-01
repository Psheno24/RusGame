import type { PlayerRow } from "./db.js";
import { getDb, getPlayer, updatePlayer } from "./db.js";
import { getCar, getCars } from "./gameData.js";
import { computeResaleValue } from "./assetTrade.js";
import { getCarShopPriceRub } from "./shopCatalog.js";

export type PlayerCarRow = {
  id: number;
  user_id: number;
  car_model_id: string;
  acquired_at: number;
  plate_text: string | null;
  plate_l1: string | null;
  plate_digits: string | null;
  plate_l2: string | null;
  plate_region: string | null;
};

export function listPlayerCars(userId: number): PlayerCarRow[] {
  return getDb()
    .prepare(
      `SELECT id, user_id, car_model_id, acquired_at, plate_text, plate_l1, plate_digits, plate_l2, plate_region
       FROM player_cars WHERE user_id = ? ORDER BY acquired_at ASC`,
    )
    .all(userId) as PlayerCarRow[];
}

export function getPlayerCarById(userId: number, playerCarId: number): PlayerCarRow | undefined {
  return getDb()
    .prepare(
      `SELECT id, user_id, car_model_id, acquired_at, plate_text, plate_l1, plate_digits, plate_l2, plate_region
       FROM player_cars WHERE user_id = ? AND id = ?`,
    )
    .get(userId, playerCarId) as PlayerCarRow | undefined;
}

export function insertPlayerCar(
  userId: number,
  carModelId: string,
  acquiredAt: number,
  plate?: Partial<
    Pick<PlayerCarRow, "plate_text" | "plate_l1" | "plate_digits" | "plate_l2" | "plate_region">
  >,
): number {
  const r = getDb()
    .prepare(
      `INSERT INTO player_cars (user_id, car_model_id, acquired_at, plate_text, plate_l1, plate_digits, plate_l2, plate_region)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      userId,
      carModelId,
      acquiredAt,
      plate?.plate_text ?? null,
      plate?.plate_l1 ?? null,
      plate?.plate_digits ?? null,
      plate?.plate_l2 ?? null,
      plate?.plate_region ?? null,
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
    const pct = car?.cooldownReducePct ?? 0;
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
  let bestPct = getCar(best.car_model_id)?.cooldownReducePct ?? 0;
  for (const c of cars) {
    const pct = getCar(c.car_model_id)?.cooldownReducePct ?? 0;
    if (pct > bestPct) {
      best = c;
      bestPct = pct;
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

export function tradeInValueForPlayerCar(row: PlayerCarRow, now = Date.now()): number | null {
  const catalogPriceRub = getCarShopPriceRub(row.car_model_id);
  if (catalogPriceRub == null) return null;
  return computeResaleValue(catalogPriceRub, "car", row.acquired_at, now, "trade_in");
}
