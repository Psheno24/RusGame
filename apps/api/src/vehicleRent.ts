import { getPlayer, updatePlayer } from "./db.js";
import { appendCityFeed, feedActorName } from "./cityFeed.js";
import { getVehicleRental } from "./gameData.js";
import { hasDriverLicense } from "./playerCars.js";

const MS_HOUR = 60 * 60 * 1000;

export function rentVehicle(
  userId: number,
  rentalId: string,
  now = Date.now(),
): { ok: true; label: string; expiresAt: number } | { ok: false; error: string } {
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
  const expiresAt = now + rental.hours * MS_HOUR;
  updatePlayer(userId, {
    rubles: player.rubles - rental.priceRub,
    vehicle_rental_id: rentalId,
    vehicle_rental_expires_at: expiresAt,
  });
  const name = feedActorName(userId);
  appendCityFeed(
    player.city_id,
    "shop:rent",
    `${name} арендовал ${rental.label} на ${rental.hours} ч`,
    userId,
  );
  return { ok: true, label: rental.label, expiresAt };
}
