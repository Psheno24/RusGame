import type { PlayerRow } from "./db.js";
import { parsePlatePartsFromRow, type VehiclePlateParts } from "./licensePlate.js";
import { getCar, getPhone, getVehicleRental } from "./gameData.js";
import { getHousingProperty } from "./housingCatalog.js";
import { housingStatusForPlayer } from "./housing.js";
import { listPlayerCars } from "./playerCars.js";
import { formatLocaleDateRu } from "./formatLocaleDate.js";
import { formatSimFromPlayer, playerHasSim } from "./simNumber.js";

export type PropertyCard = {
  id: string;
  kind: "phone" | "car" | "rental" | "housing";
  title: string;
  rightText: string | null;
  rightSubtext: string | null;
  plate: VehiclePlateParts | null;
  accent: string;
};

export function buildPropertyCards(player: PlayerRow, now = Date.now()): PropertyCard[] {
  const cards: PropertyCard[] = [];

  if (player.phone_device_id) {
    const phone = getPhone(player.phone_device_id);
    const number = playerHasSim(player) ? formatSimFromPlayer(player) : null;
    const balance = Math.floor(player.sim_balance_rub ?? 0).toLocaleString("ru-RU");
    cards.push({
      id: "phone",
      kind: "phone",
      title: phone ? `${phone.brand} ${phone.model}` : "Телефон",
      rightText: number,
      rightSubtext: number ? `${balance} ₽` : null,
      plate: null,
      accent: phone?.accent ?? "#3d4f6f",
    });
  }

  for (const row of listPlayerCars(player.user_id)) {
    const car = getCar(row.car_model_id);
    const parts = parsePlatePartsFromRow(row);
    cards.push({
      id: `car-${row.id}`,
      kind: "car",
      title: car ? `${car.brand} ${car.model} · ${car.year}` : "Автомобиль",
      rightText: null,
      rightSubtext: null,
      plate: parts,
      accent: car?.accent ?? "#4a5568",
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
      rightText: `до ${formatLocaleDateRu(player.vehicle_rental_expires_at)}`,
      rightSubtext: null,
      plate: null,
      accent: rental?.accent ?? "#2d8f5c",
    });
  }

  const housing = housingStatusForPlayer(player, now);
  if (player.housing_type === "owned" && player.housing_property_id && player.housing_city_id) {
    const prop = getHousingProperty(player.housing_city_id, player.housing_property_id);
    cards.push({
      id: "housing",
      kind: "housing",
      title: prop?.title ?? "Квартира",
      rightText: null,
      rightSubtext: null,
      plate: null,
      accent: "#5a4a7a",
    });
  } else if (housing.isResident && player.housing_type !== "owned") {
    cards.push({
      id: "housing",
      kind: "housing",
      title: player.housing_type === "rent" ? "Аренда квартиры" : "Общежитие",
      rightText: housing.expiresAt ? `до ${formatLocaleDateRu(housing.expiresAt)}` : null,
      rightSubtext: null,
      plate: null,
      accent: "#4a6fa5",
    });
  }

  return cards;
}
