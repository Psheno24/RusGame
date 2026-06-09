import { formatRub } from "./formatRub.js";

export type PlaceId =
  | "flea_market"
  | "car_repair"
  | "gas_station"
  | "education"
  | "phone_repair"
  | "police"
  | "ambulance"
  | "court";

export const CITY_PLACES: {
  id: PlaceId;
  title: string;
  hint?: string;
  /** Раздел-заглушка: для обычных игроков кнопка «Скоро» и disabled. */
  testOnly?: boolean;
}[] = [
  { id: "flea_market", title: "Барахолка", testOnly: true },
  { id: "car_repair", title: "Ремонт авто" },
  { id: "gas_station", title: "АЗС", hint: `АИ-92 от ${formatRub(70)}/л` },
  { id: "education", title: "Образование", testOnly: true },
  { id: "phone_repair", title: "Ремонт телефона", testOnly: true },
  { id: "police", title: "Полиция" },
  { id: "ambulance", title: "Скорая", testOnly: true },
  { id: "court", title: "Суд", testOnly: true },
];

export function placeById(id: PlaceId) {
  return CITY_PLACES.find((p) => p.id === id)!;
}
