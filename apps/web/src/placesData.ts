export type PlaceId =
  | "flea_market"
  | "cinema"
  | "car_repair"
  | "phone_repair"
  | "police"
  | "ambulance"
  | "court";

export const CITY_PLACES: { id: PlaceId; title: string; hint?: string }[] = [
  { id: "flea_market", title: "Барахолка" },
  { id: "cinema", title: "Кино", hint: "500 ₽ · +22 настроение" },
  { id: "car_repair", title: "Ремонт авто" },
  { id: "phone_repair", title: "Ремонт телефона" },
  { id: "police", title: "Полиция" },
  { id: "ambulance", title: "Скорая" },
  { id: "court", title: "Суд" },
];

export function placeById(id: PlaceId) {
  return CITY_PLACES.find((p) => p.id === id)!;
}
