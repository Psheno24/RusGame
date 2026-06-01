import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./config.js";
import { getCity } from "./gameData.js";

export type HousingPropertyDef = {
  id: string;
  title: string;
  district: string;
  priceRub: number;
  rooms: string;
  areaSqm: number;
};

type HousingPropertiesFile = {
  byCity: Record<string, HousingPropertyDef[]>;
  byTier: Record<string, HousingPropertyDef[]>;
};

const catalog = JSON.parse(
  readFileSync(join(DATA_DIR, "housingProperties.json"), "utf-8"),
) as HousingPropertiesFile;

export function getHousingPropertiesForCity(cityId: string): HousingPropertyDef[] {
  const cityList = catalog.byCity[cityId];
  if (cityList?.length) return [...cityList].sort((a, b) => a.priceRub - b.priceRub);
  const city = getCity(cityId);
  const tier = String(city?.tier ?? 2);
  const tierList = catalog.byTier[tier] ?? catalog.byTier["2"] ?? [];
  return [...tierList].sort((a, b) => a.priceRub - b.priceRub);
}

export function getHousingProperty(cityId: string, propertyId: string): HousingPropertyDef | undefined {
  return getHousingPropertiesForCity(cityId).find((p) => p.id === propertyId);
}

export function housingPropertyLabel(p: HousingPropertyDef): string {
  return `${p.title} (${p.district})`;
}
