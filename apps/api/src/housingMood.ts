import type { PlayerRow } from "./db.js";
import {
  carBibleMoodBonus,
  cityTierMoodBonus,
  clampBibleMood,
  housingBibleMoodBonus,
} from "./balanceBible.js";
import { getHousingProperty } from "./housingCatalog.js";
import { listPlayerCars } from "./playerCars.js";
import { getOwnedHousing, isSubletActive } from "./playerOwnedHousing.js";

/** Бонус настроения от активного места проживания (своё жильё). */
export function housingMoodBonusForPlayer(player: PlayerRow, now = Date.now()): number {
  if (player.housing_type === "owned" && player.housing_owned_id != null) {
    const row = getOwnedHousing(player.housing_owned_id, player.user_id);
    if (row && !isSubletActive(row, now)) {
      const prop = getHousingProperty(row.city_id, row.property_id);
      if (prop) return housingBibleMoodBonus(prop.typeKey);
    }
  }
  if (player.housing_type === "dorm") return housingBibleMoodBonus("dorm_room");
  if (player.housing_type === "rent" && player.housing_property_id && player.housing_city_id) {
    const prop = getHousingProperty(player.housing_city_id, player.housing_property_id);
    if (prop) return housingBibleMoodBonus(prop.typeKey);
  }
  return 0;
}

/** Настроение с учётом бонуса жилья, авто и города (для энергии и проверок). */
export function effectiveMood(player: PlayerRow, now = Date.now()): number {
  const base = player.mood ?? 0;
  const bonus =
    cityTierMoodBonus(player.city_id) +
    housingMoodBonusForPlayer(player, now) +
    carMoodBonusForPlayer(player);
  return clampBibleMood(base + bonus);
}

export function carMoodBonusForPlayer(player: PlayerRow): number {
  let best = 0;
  for (const row of listPlayerCars(player.user_id)) {
    const bonus = carBibleMoodBonus(row.car_model_id);
    if (bonus > best) best = bonus;
  }
  return best;
}
