import type { PlayerRow } from "./db.js";
import { formatVehiclePlate, parsePlatePartsFromRow } from "./licensePlate.js";
import { getCar, getPhone, getVehicleRental } from "./gameData.js";
import { getHousingProperty, housingPropertyLabel } from "./housingCatalog.js";
import { housingStatusForPlayer } from "./housing.js";
import { listPlayerCars } from "./playerCars.js";
import { formatSimFromPlayer, playerHasSim } from "./simNumber.js";

export type PropertyCard = {
  id: string;
  kind: "phone" | "car" | "plate" | "rental" | "housing" | "sim";
  title: string;
  subtitle: string;
  accent: string;
  meta: string[];
};

export function buildPropertyCards(player: PlayerRow, now = Date.now()): PropertyCard[] {
  const cards: PropertyCard[] = [];

  if (player.phone_device_id) {
    const phone = getPhone(player.phone_device_id);
    cards.push({
      id: "phone",
      kind: "phone",
      title: phone ? `${phone.brand} ${phone.model}` : "Телефон",
      subtitle: phone ? `${phone.priceRub.toLocaleString("ru-RU")} ₽ в магазине` : "",
      accent: phone?.accent ?? "#3d4f6f",
      meta: phone ? [phone.ram, phone.storage, phone.screen] : [],
    });
  }

  if (playerHasSim(player)) {
    cards.push({
      id: "sim",
      kind: "sim",
      title: "Сим-карта",
      subtitle: formatSimFromPlayer(player) ?? "Номер оформлен",
      accent: "#1e6b4f",
      meta: [`Баланс: ${Math.floor(player.sim_balance_rub ?? 0).toLocaleString("ru-RU")} ₽`],
    });
  }

  for (const row of listPlayerCars(player.user_id)) {
    const car = getCar(row.car_model_id);
    const parts =
      row.plate_l1 && row.plate_digits && row.plate_l2 && row.plate_region
        ? {
            l1: row.plate_l1,
            digits: row.plate_digits,
            l2: row.plate_l2,
            region: row.plate_region,
          }
        : parsePlatePartsFromRow(player);
    cards.push({
      id: `car-${row.id}`,
      kind: "car",
      title: car ? `${car.brand} ${car.model}` : "Автомобиль",
      subtitle: car ? `${car.year} · ${car.body}` : "",
      accent: car?.accent ?? "#4a5568",
      meta: [
        car ? `КД −${car.cooldownReducePct}%` : "",
        parts ? formatVehiclePlate(parts) : row.plate_text ?? "Госномер не оформлен",
      ].filter(Boolean),
    });
  }

  if (
    player.vehicle_rental_id &&
    player.vehicle_rental_expires_at != null &&
    player.vehicle_rental_expires_at > now
  ) {
    const rental = getVehicleRental(player.vehicle_rental_id);
    cards.push({
      id: "rental",
      kind: "rental",
      title: rental?.label ?? "Аренда транспорта",
      subtitle: "Временный транспорт",
      accent: rental?.accent ?? "#2d8f5c",
      meta: [
        `До ${new Date(player.vehicle_rental_expires_at).toLocaleString("ru-RU", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}`,
      ],
    });
  }

  const housing = housingStatusForPlayer(player, now);
  if (player.housing_type === "owned" && player.housing_property_id && player.housing_city_id) {
    const prop = getHousingProperty(player.housing_city_id, player.housing_property_id);
    cards.push({
      id: "housing",
      kind: "housing",
      title: prop?.title ?? "Своё жильё",
      subtitle: prop ? housingPropertyLabel(prop) : housing.statusLabel,
      accent: "#5a4a7a",
      meta: prop
        ? [`${prop.rooms} комн.`, `${prop.areaSqm} м²`, `${prop.priceRub.toLocaleString("ru-RU")} ₽ в магазине`]
        : [],
    });
  } else if (housing.isResident) {
    cards.push({
      id: "housing",
      kind: "housing",
      title: player.housing_type === "rent" ? "Аренда квартиры" : "Общежитие",
      subtitle: housing.statusLabel,
      accent: "#4a6fa5",
      meta: housing.expiresAt
        ? [
            `До ${new Date(housing.expiresAt).toLocaleString("ru-RU", {
              day: "numeric",
              month: "short",
            })}`,
          ]
        : [],
    });
  }

  return cards;
}
