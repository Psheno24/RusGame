import type { PlayerRow } from "./db.js";
import { getPlayer, updatePlayer } from "./db.js";
import { getVehicleRental } from "./gameData.js";
import { appendPlayerFeed } from "./playerFeed.js";
import { parseTaxiState, saveTaxiState, type TaxiState } from "./playerTaxi.js";

export function isVehicleRentalActive(
  player: PlayerRow,
  now = Date.now(),
): player is PlayerRow & { vehicle_rental_id: string; vehicle_rental_expires_at: number } {
  return Boolean(
    player.vehicle_rental_id &&
      player.vehicle_rental_expires_at != null &&
      player.vehicle_rental_expires_at > now,
  );
}

export function playerHasVehicleRentalRecord(player: PlayerRow): boolean {
  return player.vehicle_rental_id != null;
}

function clearTaxiRentalCar(state: TaxiState): TaxiState | null {
  if (!state.carSelected || state.carSource !== "rental") return state;
  if (state.activeTrip) {
    return { ...state, onLine: false, availableOrders: [], ordersRefreshAt: 0 };
  }
  return null;
}

/** Сброс выбора такси на аренде; просроченную аренду в БД не трогаем — снимает игрок в профиле. */
export function syncPlayerVehicleRental(player: PlayerRow, now = Date.now()): PlayerRow {
  const p = player;
  const rentalExpired =
    p.vehicle_rental_id != null &&
    (p.vehicle_rental_expires_at == null || p.vehicle_rental_expires_at <= now);

  const state = parseTaxiState(p);
  if (!state) return p;

  const shouldClearTaxi =
    rentalExpired || (p.vehicle_rental_id != null && !isVehicleRentalActive(p, now));
  if (!shouldClearTaxi) return p;

  const next = clearTaxiRentalCar(state);
  if (next !== state) {
    saveTaxiState(p.user_id, next ?? null);
  }

  return getPlayer(p.user_id) ?? p;
}

export function cancelVehicleRental(
  userId: number,
  now = Date.now(),
): { ok: true; message: string } | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player?.vehicle_rental_id) {
    return { ok: false, error: "Нет аренды транспорта" };
  }

  const state = parseTaxiState(player);
  if (state?.onLine) {
    return { ok: false, error: "Сначала завершите линию такси" };
  }
  if (state?.activeTrip) {
    return { ok: false, error: "Дождитесь окончания поездки" };
  }

  const label = getVehicleRental(player.vehicle_rental_id)?.label ?? "Аренда";

  updatePlayer(userId, {
    vehicle_rental_id: null,
    vehicle_rental_expires_at: null,
  });

  if (state?.carSource === "rental") {
    saveTaxiState(userId, null);
  }

  appendPlayerFeed(userId, "shop:rent", `Завершили аренду: ${label}`, now);
  return { ok: true, message: `Аренда «${label}» завершена` };
}
