import { formatRub } from "./formatRub.js";
import type { PlayerRow } from "./db.js";
import { getPlayer, updatePlayer } from "./db.js";
import { appendPlayerFeed } from "./playerFeed.js";
import { getCar } from "./gameData.js";
import {
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
  cars: GasStationCarView[];
};

function fuelPrices(): Record<FuelType, number> {
  return {
    ai92: fuelPriceRub("ai92"),
    ai95: fuelPriceRub("ai95"),
    premium: fuelPriceRub("premium"),
  };
}

function buildCarView(row: ReturnType<typeof listPlayerCars>[number]): GasStationCarView | null {
  const car = getCar(row.car_model_id);
  if (!car) return null;
  const tankL = getCarTankLiters(car);
  const fuelLevelL = getFuelLevelLiters(row, car);
  const litersToFull = Math.max(0, Math.round((tankL - fuelLevelL) * 10) / 10);
  const prices = fuelPrices();
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

export function getGasStation(player: PlayerRow): GasStationView {
  const cars = listPlayerCars(player.user_id)
    .map(buildCarView)
    .filter((x): x is GasStationCarView => x != null);
  return {
    fuelPrices: fuelPrices(),
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

  const wantLiters =
    liters != null && liters > 0
      ? Math.min(maxAdd, Math.round(liters * 10) / 10)
      : Math.round(maxAdd * 10) / 10;

  const pricePerL = fuelPriceRub(fuelType);
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
