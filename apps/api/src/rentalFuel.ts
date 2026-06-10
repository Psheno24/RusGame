import type { PlayerRow } from "./db.js";
import { getPlayer, updatePlayer } from "./db.js";
import { getCar, getVehicleRental, type CarModel } from "./gameData.js";
import {
  fuelLitersForDistance,
  getCarTankLiters,
  getFuelLevelLiters,
  recommendedFuelType,
  type FuelType,
} from "./carFuel.js";
import { isVehicleRentalActive } from "./vehicleRental.js";

export const RENTAL_TAXI_MODEL_ID = "lada-granta";

export function rentalCarModelForPlayer(player: PlayerRow): CarModel | null {
  if (!player.vehicle_rental_id) return null;
  const rental = getVehicleRental(player.vehicle_rental_id);
  const modelId = rental?.taxiCarModelId ?? null;
  if (!modelId) return null;
  return getCar(modelId) ?? null;
}

export function isRentalCarActive(player: PlayerRow, now = Date.now()): boolean {
  return isVehicleRentalActive(player, now) && rentalCarModelForPlayer(player) != null;
}

export function getRentalFuelLevelLiters(player: PlayerRow, car: CarModel): number {
  const tank = getCarTankLiters(car);
  const raw = (player as PlayerRow & { vehicle_rental_fuel_level_l?: number | null })
    .vehicle_rental_fuel_level_l;
  if (raw == null || raw < 0) return tank;
  return Math.min(tank, Math.max(0, raw));
}

export function initRentalFuelFull(userId: number, rentalId: string) {
  const rental = getVehicleRental(rentalId);
  if (!rental?.taxiCarModelId) return;
  const car = getCar(rental.taxiCarModelId);
  if (!car) return;
  updatePlayer(userId, {
    vehicle_rental_fuel_level_l: getCarTankLiters(car),
  } as Partial<PlayerRow>);
}

export function clearRentalFuel(userId: number) {
  updatePlayer(userId, { vehicle_rental_fuel_level_l: null } as Partial<PlayerRow>);
}

export function setRentalFuelLevelLiters(userId: number, liters: number) {
  updatePlayer(userId, {
    vehicle_rental_fuel_level_l: Math.max(0, Math.round(liters * 10) / 10),
  } as Partial<PlayerRow>);
}

export function consumeRentalFuelLiters(
  userId: number,
  distanceKm: number,
): { ok: boolean; car: CarModel | null } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, car: null };
  const car = rentalCarModelForPlayer(player);
  if (!car) return { ok: false, car: null };
  const used = fuelLitersForDistance(car, distanceKm);
  const current = getRentalFuelLevelLiters(player, car);
  if (current < used) {
    setRentalFuelLevelLiters(userId, 0);
    return { ok: false, car };
  }
  setRentalFuelLevelLiters(userId, current - used);
  return { ok: true, car };
}

export function hasRentalFuelForDistance(player: PlayerRow, distanceKm: number): boolean {
  const car = rentalCarModelForPlayer(player);
  if (!car) return true;
  const need = fuelLitersForDistance(car, distanceKm);
  return getRentalFuelLevelLiters(player, car) >= need;
}

export function rentalFuelSummary(player: PlayerRow): {
  car: CarModel;
  fuelLevelL: number;
  tankL: number;
  recommendedFuel: FuelType;
  label: string;
} | null {
  const car = rentalCarModelForPlayer(player);
  if (!car) return null;
  const rental = getVehicleRental(player.vehicle_rental_id!);
  return {
    car,
    fuelLevelL: getRentalFuelLevelLiters(player, car),
    tankL: getCarTankLiters(car),
    recommendedFuel: recommendedFuelType(car),
    label: rental?.label ?? "Аренда",
  };
}
