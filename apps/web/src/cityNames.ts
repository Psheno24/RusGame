/** Русские названия городов по id из API. */
const CITY_NAMES_RU: Record<string, string> = {
  moscow: "Москва",
  spb: "Санкт-Петербург",
  novosibirsk: "Новосибирск",
  ekb: "Екатеринбург",
  kazan: "Казань",
  nn: "Нижний Новгород",
  chelyabinsk: "Челябинск",
  samara: "Самара",
  omsk: "Омск",
  rostov: "Ростов-на-Дону",
  ufa: "Уфа",
  krasnoyarsk: "Красноярск",
  voronezh: "Воронеж",
  perm: "Пермь",
  volgograd: "Волгоград",
  krasnodar: "Краснодар",
};

export function cityDisplayName(cityId: string): string {
  const name = CITY_NAMES_RU[cityId];
  if (name) return name;
  if (!cityId) return "—";
  return cityId.charAt(0).toUpperCase() + cityId.slice(1);
}
