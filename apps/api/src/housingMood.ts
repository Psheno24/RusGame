import type { PlayerRow } from "./db.js";
import {
  carBibleMoodBonus,
  cityTierMoodBonus,
  clampBibleMood,
} from "./balanceBible.js";
import { getHousingProperty, housingTypeMoodBonus } from "./housingCatalog.js";
import { listPlayerCars } from "./playerCars.js";
import { getOwnedHousing, isSubletActive } from "./playerOwnedHousing.js";

function hasActiveTemporaryHousing(player: PlayerRow, now: number): boolean {
  return (
    (player.housing_type === "dorm" || player.housing_type === "rent") &&
    player.housing_expires_at != null &&
    player.housing_expires_at > now
  );
}

/** Бонус настроения от активного места проживания (своё жильё). */
export function housingMoodBonusForPlayer(player: PlayerRow, now = Date.now()): number {
  if (player.housing_type === "owned" && player.housing_owned_id != null) {
    const row = getOwnedHousing(player.housing_owned_id, player.user_id);
    if (row && !isSubletActive(row, now)) {
      const prop = getHousingProperty(row.city_id, row.property_id);
      if (prop) return housingTypeMoodBonus(prop.typeKey);
    }
  }
  if (!hasActiveTemporaryHousing(player, now)) return 0;
  if (player.housing_type === "dorm") return housingTypeMoodBonus("dorm_room");
  if (player.housing_type === "rent" && player.housing_property_id && player.housing_city_id) {
    const prop = getHousingProperty(player.housing_city_id, player.housing_property_id);
    if (prop) return housingTypeMoodBonus(prop.typeKey);
  }
  return 0;
}

/** Настроение: только город, активное жильё и лучший автомобиль (не меняется от действий). */
export function effectiveMood(player: PlayerRow, now = Date.now()): number {
  return clampBibleMood(
    cityTierMoodBonus(player.city_id) +
      housingMoodBonusForPlayer(player, now) +
      carMoodBonusForPlayer(player),
  );
}

export function carMoodBonusForPlayer(player: PlayerRow): number {
  let best = 0;
  for (const row of listPlayerCars(player.user_id)) {
    const bonus = carBibleMoodBonus(row.car_model_id);
    if (bonus > best) best = bonus;
  }
  return best;
}
