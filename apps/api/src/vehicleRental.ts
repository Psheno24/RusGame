import type { PlayerRow } from "./db.js";
import { getPlayer, updatePlayer } from "./db.js";
import { parseTaxiState, saveTaxiState, type TaxiState } from "./playerTaxi.js";

export function isVehicleRentalActive(player: PlayerRow, now = Date.now()): boolean {
  return Boolean(
    player.vehicle_rental_id &&
      player.vehicle_rental_expires_at != null &&
      player.vehicle_rental_expires_at > now,
  );
}

function clearTaxiRentalCar(state: TaxiState): TaxiState | null {
  if (!state.carSelected || state.carSource !== "rental") return state;
  if (state.activeTrip) {
    return { ...state, onLine: false, availableOrders: [], ordersRefreshAt: 0 };
  }
  return null;
}

/** Сброс просроченной аренды и такси на арендованном авто. */
export function syncPlayerVehicleRental(player: PlayerRow, now = Date.now()): PlayerRow {
  let p = player;
  const rentalExpired =
    p.vehicle_rental_id != null &&
    (p.vehicle_rental_expires_at == null || p.vehicle_rental_expires_at <= now);

  if (rentalExpired) {
    updatePlayer(p.user_id, {
      vehicle_rental_id: null,
      vehicle_rental_expires_at: null,
    });
    p = getPlayer(p.user_id) ?? { ...p, vehicle_rental_id: null, vehicle_rental_expires_at: null };
  }

  const state = parseTaxiState(p);
  if (!state) return p;

  const next = clearTaxiRentalCar(state);
  if (next !== state) {
    saveTaxiState(p.user_id, next);
  }

  return getPlayer(p.user_id) ?? p;
}
