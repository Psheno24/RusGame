import type { CityPin } from "./api";
import { cityDisplayName } from "./cityNames";
import { CITY_NODES } from "./mapMetroLayout";

const PLAYABLE = new Set(["omsk", "kazan"]);

/** Города для схемы карты без ожидания API. */
export function staticMapCities(): CityPin[] {
  return Object.keys(CITY_NODES).map((id) => ({
    id,
    name: cityDisplayName(id),
    tier: 2,
    mapX: 0,
    mapY: 0,
    playable: PLAYABLE.has(id),
  }));
}
