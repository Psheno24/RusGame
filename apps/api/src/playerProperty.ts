import type { PlayerRow } from "./db.js";
import { parsePlatePartsFromRow, type VehiclePlateParts } from "./licensePlate.js";
import { getCar, getPhone, getVehicleRental } from "./gameData.js";
import { getCity } from "./gameData.js";
import { getHousingProperty } from "./housingCatalog.js";
import { housingStatusForPlayer, syncPlayerHousing } from "./housing.js";
import { listPlayerCars } from "./playerCars.js";
import { formatLocaleDateRu } from "./formatLocaleDate.js";
import { formatSimFromPlayer, playerHasSim } from "./simNumber.js";
import { isSubletActive, listOwnedHousing } from "./playerOwnedHousing.js";
import { isVehicleRentalActive, playerHasVehicleRentalRecord } from "./vehicleRental.js";

export type PropertyCard = {
  id: string;
  kind: "phone" | "car" | "rental" | "housing";
  title: string;
  rightText: string | null;
  rightSubtext: string | null;
  plate: VehiclePlateParts | null;
  accent: string;
  housingOwnedId?: number;
  cityId?: string;
  cityName?: string;
  isActiveResidence?: boolean;
  isSublet?: boolean;
  subletUntil?: number | null;
  canLiveHere?: boolean;
};

export function buildPropertyCards(player: PlayerRow, now = Date.now()): PropertyCard[] {
  const cards: PropertyCard[] = [];
  const p = syncPlayerHousing(player, now);

  if (p.phone_device_id) {
    const phone = getPhone(p.phone_device_id);
    const number = playerHasSim(p) ? formatSimFromPlayer(p) : null;
    const balance = Math.floor(p.sim_balance_rub ?? 0).toLocaleString("ru-RU");
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

  for (const row of listPlayerCars(p.user_id)) {
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

  if (playerHasVehicleRentalRecord(p)) {
    const rental = getVehicleRental(p.vehicle_rental_id!);
    const active = isVehicleRentalActive(p, now);
    cards.push({
      id: "rental",
      kind: "rental",
      title: rental?.label ?? "Аренда транспорта",
      rightText: active
        ? `до ${formatLocaleDateRu(p.vehicle_rental_expires_at!)}`
        : "истекла",
      rightSubtext: active ? null : "нажмите, чтобы снять",
      plate: null,
      accent: rental?.accent ?? "#2d8f5c",
    });
  }

  for (const owned of listOwnedHousing(p.user_id)) {
    const prop = getHousingProperty(owned.city_id, owned.property_id);
    const city = getCity(owned.city_id);
    const cityName = city?.name ?? owned.city_id;
    const title = prop?.title ?? "Квартира";
    const isActive =
      p.housing_type === "owned" && p.housing_owned_id === owned.id && !isSubletActive(owned, now);
    const sublet = isSubletActive(owned, now);
    cards.push({
      id: `housing-${owned.id}`,
      kind: "housing",
      title: `${title} (${cityName})`,
      rightText: sublet && owned.sublet_until ? `сдана до ${formatLocaleDateRu(owned.sublet_until)}` : null,
      rightSubtext: null,
      plate: null,
      accent: "#5a4a7a",
      housingOwnedId: owned.id,
      cityId: owned.city_id,
      cityName,
      isActiveResidence: isActive,
      isSublet: sublet,
      subletUntil: owned.sublet_until,
      canLiveHere: !isActive,
    });
  }

  const housing = housingStatusForPlayer(p, now);
  if (housing.isResident && p.housing_type !== "owned") {
    const city = p.housing_city_id ? getCity(p.housing_city_id) : null;
    const cityLabel = city?.name ?? p.housing_city_id ?? "";
    cards.push({
      id: "housing-rent",
      kind: "housing",
      title: `${p.housing_type === "rent" ? "Аренда" : "Общежитие"} (${cityLabel})`,
      rightText: housing.expiresAt ? `до ${formatLocaleDateRu(housing.expiresAt)}` : null,
      rightSubtext: null,
      plate: null,
      accent: "#4a6fa5",
      isActiveResidence: true,
      canLiveHere: false,
    });
  }

  return cards;
}
