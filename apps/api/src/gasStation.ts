import { formatRub } from "./formatRub.js";
import type { PlayerRow } from "./db.js";
import { getPlayer, updatePlayer } from "./db.js";
import { appendPlayerFeed } from "./playerFeed.js";
import { getCar } from "./gameData.js";
import {
  fuelPriceHints,
  fuelPriceRub,
  getCarTankLiters,
  getFuelLevelLiters,
  recommendedFuelType,
  setFuelLevelLiters,
  type FuelType,
} from "./carFuel.js";
import { getPlayerCarById, listPlayerCars } from "./playerCars.js";
import { isVehicleRentalActive } from "./vehicleRental.js";
import {
  getRentalFuelLevelLiters,
  rentalFuelSummary,
  setRentalFuelLevelLiters,
} from "./rentalFuel.js";

export type GasStationCarView = {
  playerCarId: number | null;
  isRental: boolean;
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

function roundFuelLiters(n: number): number {
  return Math.round(n * 10) / 10;
}

function resolveRefuelLiters(maxAdd: number, liters?: number): number | { error: string } {
  const cap = roundFuelLiters(maxAdd);
  if (cap <= 0) return { error: "Бак уже полный" };

  if (liters != null && liters > 0) {
    const requested = roundFuelLiters(liters);
    if (requested <= 0) return { error: "Укажите количество литров" };
    const want = Math.min(cap, requested);
    if (want <= 0) return { error: "Бак уже полный" };
    return want;
  }

  return cap;
}

function fuelPrices(cityId: string, now = Date.now()): Record<FuelType, number> {
  return {
    ai92: fuelPriceRub("ai92", cityId, now),
    ai95: fuelPriceRub("ai95", cityId, now),
    premium: fuelPriceRub("premium", cityId, now),
  };
}

function buildOwnedCarView(
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
    isRental: false,
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

function buildRentalCarView(
  player: PlayerRow,
  prices: Record<FuelType, number>,
): GasStationCarView | null {
  const summary = rentalFuelSummary(player);
  if (!summary) return null;
  const { car, fuelLevelL, tankL, recommendedFuel, label } = summary;
  const litersToFull = Math.max(0, Math.round((tankL - fuelLevelL) * 10) / 10);
  const fillCostRub: Record<FuelType, number> = {
    ai92: Math.round(litersToFull * prices.ai92),
    ai95: Math.round(litersToFull * prices.ai95),
    premium: Math.round(litersToFull * prices.premium),
  };
  return {
    playerCarId: null,
    isRental: true,
    brand: label,
    model: "аренда",
    accent: "#4a5568",
    fuelLevelL,
    tankL,
    fuelPct: tankL > 0 ? Math.round((fuelLevelL / tankL) * 100) : 0,
    litersToFull,
    recommendedFuel,
    fillCostRub,
  };
}

export function getGasStation(player: PlayerRow, now = Date.now()): GasStationView {
  const prices = fuelPrices(player.city_id, now);
  const cars = listPlayerCars(player.user_id)
    .map((row) => buildOwnedCarView(row, prices))
    .filter((x): x is GasStationCarView => x != null);
  if (isVehicleRentalActive(player, now)) {
    const rentalView = buildRentalCarView(player, prices);
    if (rentalView) cars.push(rentalView);
  }
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

  const resolved = resolveRefuelLiters(maxAdd, liters);
  if (typeof resolved !== "number") return { ok: false, error: resolved.error };
  const wantLiters = resolved;

  const pricePerL = fuelPriceRub(fuelType, player.city_id, now);
  const costRub = Math.round(wantLiters * pricePerL);
  if (player.rubles < costRub) {
    return { ok: false, error: `Нужно ${formatRub(costRub)}` };
  }

  const nextLevel = roundFuelLiters(Math.min(tankL, current + wantLiters));
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

export function refuelRentalCar(
  userId: number,
  fuelType: FuelType,
  liters?: number,
  now = Date.now(),
):
  | { ok: true; liters: number; costRub: number; fuelLevelL: number; carName: string }
  | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  if (!isVehicleRentalActive(player, now)) {
    return { ok: false, error: "Нет активной аренды автомобиля" };
  }
  const summary = rentalFuelSummary(player);
  if (!summary) return { ok: false, error: "Арендованный автомобиль не найден" };

  const { car, fuelLevelL, tankL, label } = summary;
  const current = fuelLevelL;
  const maxAdd = Math.max(0, tankL - current);
  if (maxAdd <= 0) return { ok: false, error: "Бак уже полный" };

  const resolved = resolveRefuelLiters(maxAdd, liters);
  if (typeof resolved !== "number") return { ok: false, error: resolved.error };
  const wantLiters = resolved;

  const pricePerL = fuelPriceRub(fuelType, player.city_id, now);
  const costRub = Math.round(wantLiters * pricePerL);
  if (player.rubles < costRub) {
    return { ok: false, error: `Нужно ${formatRub(costRub)}` };
  }

  const nextLevel = roundFuelLiters(Math.min(tankL, current + wantLiters));
  updatePlayer(userId, { rubles: player.rubles - costRub });
  setRentalFuelLevelLiters(userId, nextLevel);

  const carName = `${label} (аренда)`;
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
