import type { PlayerRow } from "./db.js";
import { getCar } from "./gameData.js";
import { getCarPrestige, prestigeToMoodBonus } from "./carStats.js";
import { listPlayerCars } from "./playerCars.js";

/** Пассивный бонус настроения от лучшего автомобиля в гараже. */
export function carMoodBonusForPlayer(player: PlayerRow): number {
  let best = 0;
  for (const row of listPlayerCars(player.user_id)) {
    const car = getCar(row.car_model_id);
    if (!car) continue;
    const bonus = prestigeToMoodBonus(getCarPrestige(car));
    if (bonus > best) best = bonus;
  }
  return best;
}
