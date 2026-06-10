import { formatRub } from "./formatRub.js";
import type { PlayerRow } from "./db.js";
import { getPlayer, updatePlayer } from "./db.js";
import { appendPlayerFeed } from "./playerFeed.js";
import { getCar } from "./gameData.js";
import {
  fuelPriceHints,
  fuelPriceRub,
  getCarConsumptionL100,
  getCarTankLiters,
  getFuelLevelLiters,
  recommendedFuelType,
  setFuelLevelLiters,
  type FuelType,
} from "./carFuel.js";
import { getPlayerCarById, listPlayerCars } from "./playerCars.js";

export type GasStationCarView = {
  playerCarId: number;
  brand: string;
  model: string;
  accent: string;
  fuelLevelL: number;
  tankL: number;
  fuelPct: number;
  litersToFull: number;
  recommendedFuel: FuelType;
  fillCostRub: Record<FuelType, number>;
};

export type GasStationView = {
  fuelPrices: Record<FuelType, number>;
  fuelPriceHints: string[];
  cars: GasStationCarView[];
};

function fuelPrices(cityId: string, now = Date.now()): Record<FuelType, number> {
  return {
    ai92: fuelPriceRub("ai92", cityId, now),
    ai95: fuelPriceRub("ai95", cityId, now),
    premium: fuelPriceRub("premium", cityId, now),
  };
}

function buildCarView(
  row: ReturnType<typeof listPlayerCars>[number],
  prices: Record<FuelType, number>,
): GasStationCarView | null {
  const car = getCar(row.car_model_id);
  if (!car) return null;
  const tankL = getCarTankLiters(car);
  const fuelLevelL = getFuelLevelLiters(row, car);
  const litersToFull = Math.max(0, Math.round((tankL - fuelLevelL) * 10) / 10);
  const fillCostRub: Record<FuelType, number> = {
    ai92: Math.round(litersToFull * prices.ai92),
    ai95: Math.round(litersToFull * prices.ai95),
    premium: Math.round(litersToFull * prices.premium),
  };
  return {
    playerCarId: row.id,
    brand: car.brand,
    model: car.model,
    accent: car.accent,
    fuelLevelL,
    tankL,
    fuelPct: tankL > 0 ? Math.round((fuelLevelL / tankL) * 100) : 0,
    litersToFull,
    recommendedFuel: recommendedFuelType(car),
    fillCostRub,
  };
}

export function getGasStation(player: PlayerRow, now = Date.now()): GasStationView {
  const prices = fuelPrices(player.city_id, now);
  const cars = listPlayerCars(player.user_id)
    .map((row) => buildCarView(row, prices))
    .filter((x): x is GasStationCarView => x != null);
  return {
    fuelPrices: prices,
    fuelPriceHints: fuelPriceHints(player.city_id, now),
    cars,
  };
}

export function refuelCar(
  userId: number,
  playerCarId: number,
  fuelType: FuelType,
  liters?: number,
  now = Date.now(),
):
  | { ok: true; liters: number; costRub: number; fuelLevelL: number; carName: string }
  | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };

  const row = getPlayerCarById(userId, playerCarId);
  if (!row) return { ok: false, error: "Автомобиль не найден" };

  const car = getCar(row.car_model_id);
  if (!car) return { ok: false, error: "Модель не найдена" };

  const tankL = getCarTankLiters(car);
  const current = getFuelLevelLiters(row, car);
  const maxAdd = Math.max(0, tankL - current);
  if (maxAdd <= 0) return { ok: false, error: "Бак уже полный" };

  let wantLiters: number;
  if (liters != null && liters > 0) {
    const rounded = Math.round(liters);
    if (rounded < 1) return { ok: false, error: "Минимум 1 литр" };
    wantLiters = Math.min(Math.floor(maxAdd), rounded);
    if (wantLiters < 1) return { ok: false, error: "Бак уже полный" };
  } else {
    wantLiters = Math.round(maxAdd * 10) / 10;
  }

  const pricePerL = fuelPriceRub(fuelType, player.city_id, now);
  const costRub = Math.round(wantLiters * pricePerL);
  if (player.rubles < costRub) {
    return { ok: false, error: `Нужно ${formatRub(costRub)}` };
  }

  const nextLevel = Math.min(tankL, current + wantLiters);
  updatePlayer(userId, { rubles: player.rubles - costRub });
  setFuelLevelLiters(userId, playerCarId, nextLevel);

  const carName = `${car.brand} ${car.model}`;
  appendPlayerFeed(
    userId,
    "shop:car",
    `АЗС: ${carName} +${wantLiters} л ${fuelType.toUpperCase()} (−${formatRub(costRub)})`,
    now,
  );

  return {
    ok: true,
    liters: wantLiters,
    costRub,
    fuelLevelL: nextLevel,
    carName,
  };
}
