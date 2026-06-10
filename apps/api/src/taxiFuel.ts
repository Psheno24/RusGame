import type { PlayerRow } from "./db.js";
import { getCar } from "./gameData.js";
import {
  fuelLitersForDistance,
  getFuelLevelLiters,
  hasOwnedFuelForDistance,
  insufficientFuelMessage,
} from "./carFuel.js";
import { getPlayerCarById } from "./playerCars.js";
import { resolveTaxiPlayerCarId } from "./carWear.js";
import {
  getRentalFuelLevelLiters,
  hasRentalFuelForDistance,
  rentalCarModelForPlayer,
} from "./rentalFuel.js";
import type { TaxiState } from "./playerTaxi.js";

export function taxiFuelBlockReason(
  player: PlayerRow,
  state: TaxiState,
  distanceKm: number,
): string | null {
  if (state.carSource === "owned") {
    const carId = resolveTaxiPlayerCarId(player.user_id, state.carSource, state.carRefId);
    if (carId == null) return null;
    if (hasOwnedFuelForDistance(player.user_id, carId, distanceKm)) return null;
    const row = getPlayerCarById(player.user_id, carId);
    const car = row ? getCar(row.car_model_id) : null;
    if (!row || !car) return "Недостаточно бензина на поездку.";
    const need = fuelLitersForDistance(car, distanceKm);
    const have = getFuelLevelLiters(row, car);
    return insufficientFuelMessage(need, have);
  }
  if (state.carSource === "rental") {
    if (hasRentalFuelForDistance(player, distanceKm)) return null;
    const car = rentalCarModelForPlayer(player);
    if (!car) return null;
    const need = fuelLitersForDistance(car, distanceKm);
    const have = getRentalFuelLevelLiters(player, car);
    return insufficientFuelMessage(need, have);
  }
  return null;
}
