import type { PlayerRow } from "./db.js";
import { getDb, getPlayer, updatePlayer } from "./db.js";
import { getCar } from "./gameData.js";
import { appendPlayerFeed } from "./playerFeed.js";
import {
  PLATE_PRICES,
  formatVehiclePlate,
  listTakenVehiclePlateKeys,
  parsePlatePartsFromRow,
  rollUniqueVehiclePlateDigits,
  rollUniqueVehiclePlateLetters,
  rollUniqueVehiclePlateParts,
  rollUniqueVehiclePlateRegion,
  type VehiclePlateParts,
} from "./licensePlate.js";
import { getPlayerCarById, listPlayerCars, syncPlayerCarSummary } from "./playerCars.js";

export type PlateGarageCar = {
  playerCarId: number;
  modelId: string;
  brand: string;
  model: string;
  accent: string;
  plate: VehiclePlateParts | null;
  plateText: string | null;
};

export type PlateShopCarView = {
  playerCarId: number;
  brand: string;
  model: string;
  accent: string;
  prices: typeof PLATE_PRICES;
  plate: VehiclePlateParts | null;
  plateText: string | null;
};

function plateTextFromRow(row: {
  plate_text: string | null;
  plate_l1: string | null;
  plate_digits: string | null;
  plate_l2: string | null;
  plate_region: string | null;
}): string | null {
  if (row.plate_text) return row.plate_text;
  const parts = parsePlatePartsFromRow(row);
  return parts ? formatVehiclePlate(parts) : null;
}

export function getPlateGarageList(player: PlayerRow): PlateGarageCar[] {
  return listPlayerCars(player.user_id)
    .map((row) => {
      const car = getCar(row.car_model_id);
      if (!car) return null;
      return {
        playerCarId: row.id,
        modelId: row.car_model_id,
        brand: car.brand,
        model: car.model,
        accent: car.accent,
        plate: parsePlatePartsFromRow(row),
        plateText: plateTextFromRow(row),
      };
    })
    .filter((x): x is PlateGarageCar => x != null);
}

export function getPlateShopViewForCar(
  player: PlayerRow,
  playerCarId: number,
): PlateShopCarView | { error: string } {
  const row = getPlayerCarById(player.user_id, playerCarId);
  if (!row) return { error: "Автомобиль не найден" };
  const car = getCar(row.car_model_id);
  if (!car) return { error: "Модель не найдена" };
  const parts = parsePlatePartsFromRow(row);
  return {
    playerCarId: row.id,
    brand: car.brand,
    model: car.model,
    accent: car.accent,
    prices: PLATE_PRICES,
    plate: parts,
    plateText: plateTextFromRow(row),
  };
}

function patchPlateForCar(
  userId: number,
  playerCarId: number,
  parts: VehiclePlateParts,
  rublesDelta: number,
): { ok: true; plateText: string } | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  const row = getPlayerCarById(userId, playerCarId);
  if (!row) return { ok: false, error: "Автомобиль не найден" };
  const plateText = formatVehiclePlate(parts);
  getDb()
    .prepare(
      `UPDATE player_cars SET
        plate_text = ?, plate_l1 = ?, plate_digits = ?, plate_l2 = ?, plate_region = ?
       WHERE id = ? AND user_id = ?`,
    )
    .run(plateText, parts.l1, parts.digits, parts.l2, parts.region, playerCarId, userId);
  updatePlayer(userId, { rubles: player.rubles + rublesDelta });
  syncPlayerCarSummary(userId);
  return { ok: true, plateText };
}

export function registerVehiclePlate(
  userId: number,
  playerCarId: number,
): { ok: true; plateText: string } | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  const row = getPlayerCarById(userId, playerCarId);
  if (!row) return { ok: false, error: "Автомобиль не найден" };
  if (parsePlatePartsFromRow(row)) return { ok: false, error: "Госномер уже оформлен" };
  if (player.rubles < PLATE_PRICES.register) {
    return { ok: false, error: `Нужно ${PLATE_PRICES.register.toLocaleString("ru-RU")} ₽` };
  }
  const taken = listTakenVehiclePlateKeys(playerCarId);
  const parts = rollUniqueVehiclePlateParts(taken);
  const result = patchPlateForCar(userId, playerCarId, parts, -PLATE_PRICES.register);
  if (!result.ok) return result;
  const car = getCar(row.car_model_id);
  const carName = car ? `${car.brand} ${car.model}` : "авто";
  appendPlayerFeed(
    userId,
    "shop:plate",
    `Оформили госномер ${result.plateText} на ${carName}`,
    Date.now(),
  );
  return result;
}

export function changePlateDigits(
  userId: number,
  playerCarId: number,
): { ok: true; plateText: string } | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  const row = getPlayerCarById(userId, playerCarId);
  if (!row) return { ok: false, error: "Автомобиль не найден" };
  const current = parsePlatePartsFromRow(row);
  if (!current) return { ok: false, error: "Сначала оформите госномер" };
  if (player.rubles < PLATE_PRICES.digits) {
    return { ok: false, error: `Нужно ${PLATE_PRICES.digits.toLocaleString("ru-RU")} ₽` };
  }
  const taken = listTakenVehiclePlateKeys(playerCarId);
  const digits = rollUniqueVehiclePlateDigits(taken, current);
  return patchPlateForCar(userId, playerCarId, { ...current, digits }, -PLATE_PRICES.digits);
}

export function changePlateLetters(
  userId: number,
  playerCarId: number,
): { ok: true; plateText: string } | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  const row = getPlayerCarById(userId, playerCarId);
  if (!row) return { ok: false, error: "Автомобиль не найден" };
  const current = parsePlatePartsFromRow(row);
  if (!current) return { ok: false, error: "Сначала оформите госномер" };
  if (player.rubles < PLATE_PRICES.letters) {
    return { ok: false, error: `Нужно ${PLATE_PRICES.letters.toLocaleString("ru-RU")} ₽` };
  }
  const taken = listTakenVehiclePlateKeys(playerCarId);
  const letters = rollUniqueVehiclePlateLetters(taken, current);
  return patchPlateForCar(userId, playerCarId, { ...current, ...letters }, -PLATE_PRICES.letters);
}

export function changePlateRegion(
  userId: number,
  playerCarId: number,
): { ok: true; plateText: string } | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  const row = getPlayerCarById(userId, playerCarId);
  if (!row) return { ok: false, error: "Автомобиль не найден" };
  const current = parsePlatePartsFromRow(row);
  if (!current) return { ok: false, error: "Сначала оформите госномер" };
  if (player.rubles < PLATE_PRICES.region) {
    return { ok: false, error: `Нужно ${PLATE_PRICES.region.toLocaleString("ru-RU")} ₽` };
  }
  const taken = listTakenVehiclePlateKeys(playerCarId);
  const region = rollUniqueVehiclePlateRegion(taken, current);
  return patchPlateForCar(userId, playerCarId, { ...current, region }, -PLATE_PRICES.region);
}
