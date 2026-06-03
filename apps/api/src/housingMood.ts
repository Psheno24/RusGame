import type { PlayerRow } from "./db.js";
import { carMoodBonusForPlayer } from "./carMood.js";
import { getHousingProperty } from "./housingCatalog.js";
import { getOwnedHousing, isSubletActive } from "./playerOwnedHousing.js";

/** Бонус настроения от активного места проживания (своё жильё). */
export function housingMoodBonusForPlayer(player: PlayerRow, now = Date.now()): number {
  if (player.housing_type !== "owned" || player.housing_owned_id == null) return 0;
  const row = getOwnedHousing(player.housing_owned_id, player.user_id);
  if (!row || isSubletActive(row, now)) return 0;
  const prop = getHousingProperty(row.city_id, row.property_id);
  return prop?.moodBonus ?? 0;
}

/** Настроение с учётом бонуса жилья (для проверок и выплат). */
export function effectiveMood(player: PlayerRow, now = Date.now()): number {
  const base = player.mood ?? 70;
  const bonus = housingMoodBonusForPlayer(player, now) + carMoodBonusForPlayer(player);
  return Math.max(0, Math.min(100, base + bonus));
}
