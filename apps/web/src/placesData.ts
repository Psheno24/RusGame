export type PlaceId = "tire" | "phone_repair" | "police" | "ambulance" | "court";

export const CITY_PLACES: { id: PlaceId; title: string; hint: string }[] = [
  { id: "tire", title: "Шиномонтаж", hint: "Шины и колёса" },
  { id: "phone_repair", title: "Ремонт телефона", hint: "Починка смартфона" },
  { id: "police", title: "Полиция", hint: "Обращения и справки" },
  { id: "ambulance", title: "Скорая", hint: "Медицинская помощь" },
  { id: "court", title: "Суд", hint: "Судебные дела" },
];

export function placeById(id: PlaceId) {
  return CITY_PLACES.find((p) => p.id === id)!;
}
