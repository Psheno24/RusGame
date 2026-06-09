import { formatRub } from "./formatRub.js";
import { getPlayer, updatePlayer } from "./db.js";
import { appendPlayerFeed } from "./playerFeed.js";
import { getVehicleRental } from "./gameData.js";
import { hasDriverLicense } from "./playerCars.js";
import { playerHasVehicleRentalRecord } from "./vehicleRental.js";
import { buildVehicleRentalTimeInfo } from "./vehicleRentalDisplay.js";

const MS_HOUR = 60 * 60 * 1000;
export const VEHICLE_RENT_MIN_HOURS = 1;
export const VEHICLE_RENT_MAX_HOURS = 24;

export function rentVehicle(
  userId: number,
  rentalId: string,
  hours: number,
  now = Date.now(),
):
  | { ok: true; label: string; expiresAt: number; message: string }
  | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  const rental = getVehicleRental(rentalId);
  if (!rental) return { ok: false, error: "Вариант не найден" };
  if (
    !Number.isInteger(hours) ||
    hours < VEHICLE_RENT_MIN_HOURS ||
    hours > VEHICLE_RENT_MAX_HOURS
  ) {
    return {
      ok: false,
      error: `Срок аренды: от ${VEHICLE_RENT_MIN_HOURS} до ${VEHICLE_RENT_MAX_HOURS} ч`,
    };
  }
  if (rental.needsLicense && !hasDriverLicense(player, "B")) {
    return { ok: false, error: "Нужны права категории B — оформите в полиции" };
  }
  const priceRub = rental.pricePerHourRub * hours;
  if (player.rubles < priceRub) {
    return { ok: false, error: `Нужно ${formatRub(priceRub)}` };
  }
  if (playerHasVehicleRentalRecord(player)) {
    return {
      ok: false,
      error: "Сначала завершите текущую аренду в профиле → имущество",
    };
  }
  const expiresAt = now + hours * MS_HOUR;
  updatePlayer(userId, {
    rubles: player.rubles - priceRub,
    vehicle_rental_id: rentalId,
    vehicle_rental_expires_at: expiresAt,
  });
  appendPlayerFeed(
    userId,
    "shop:rent",
    `Арендовали ${rental.label} на ${hours} ч`,
    now,
  );
  const refreshed = getPlayer(userId);
  const timeInfo = refreshed ? buildVehicleRentalTimeInfo(refreshed, now) : null;
  const message = timeInfo
    ? `Арендовали ${rental.label}. Осталось: ${timeInfo.remainingLabel}`
    : `Арендовали ${rental.label} на ${hours} ч`;
  return { ok: true, label: rental.label, expiresAt, message };
}
