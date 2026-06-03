import { getPlayer, updatePlayer } from "./db.js";
import { appendPlayerFeed } from "./playerFeed.js";
import { getVehicleRental } from "./gameData.js";
import { hasDriverLicense } from "./playerCars.js";
import { playerHasVehicleRentalRecord } from "./vehicleRental.js";
import { buildVehicleRentalTimeInfo } from "./vehicleRentalDisplay.js";

const MS_HOUR = 60 * 60 * 1000;

export function rentVehicle(
  userId: number,
  rentalId: string,
  now = Date.now(),
):
  | { ok: true; label: string; expiresAt: number; message: string }
  | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  const rental = getVehicleRental(rentalId);
  if (!rental) return { ok: false, error: "Вариант не найден" };
  if (rental.needsLicense && !hasDriverLicense(player, "B")) {
    return { ok: false, error: "Нужны права категории B — оформите в полиции" };
  }
  if (player.rubles < rental.priceRub) {
    return { ok: false, error: `Нужно ${rental.priceRub.toLocaleString("ru-RU")} ₽` };
  }
  if (playerHasVehicleRentalRecord(player)) {
    return {
      ok: false,
      error: "Сначала завершите текущую аренду в профиле → имущество",
    };
  }
  const expiresAt = now + rental.hours * MS_HOUR;
  updatePlayer(userId, {
    rubles: player.rubles - rental.priceRub,
    vehicle_rental_id: rentalId,
    vehicle_rental_expires_at: expiresAt,
  });
  appendPlayerFeed(
    userId,
    "shop:rent",
    `Арендовали ${rental.label} на ${rental.hours} ч`,
    now,
  );
  const refreshed = getPlayer(userId);
  const timeInfo = refreshed ? buildVehicleRentalTimeInfo(refreshed, now) : null;
  const message = timeInfo
    ? `Арендовали ${rental.label}. ${timeInfo.remainingLabel} — до ${timeInfo.expiresLabel} (${timeInfo.cityName}, время сервера игры)`
    : `Арендовали ${rental.label} на ${rental.hours} ч`;
  return { ok: true, label: rental.label, expiresAt, message };
}
