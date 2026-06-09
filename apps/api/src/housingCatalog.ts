import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./config.js";
import { getCityEconomyMultiplier } from "./balanceBible.js";

export type HousingPropertyDef = {
  id: string;
  typeKey: string;
  title: string;
  district: string;
  cityId: string;
  priceRub: number;
  prestige: number;
  moodBonus: number;
  description: string;
  rooms: string;
  areaSqm: number;
  monthlyRentRub: number;
  monthlyExpensesRub: number;
  monthlyNetIncomeRub: number;
  weeklyRentRub: number;
  weeklyExpensesRub: number;
  weeklyNetIncomeRub: number;
  expenseRatePct: number;
};

type HousingPropertyTypeDef = {
  key: string;
  moodBonus: number;
};

type HousingPropertiesFile = {
  version?: number;
  propertyTypes?: HousingPropertyTypeDef[];
  cityMultipliers?: Record<string, number>;
  byCity: Record<string, HousingPropertyDef[]>;
};

const catalog = JSON.parse(
  readFileSync(join(DATA_DIR, "housingProperties.json"), "utf-8"),
) as HousingPropertiesFile;

const sortedByCity: Record<string, HousingPropertyDef[]> = {};
for (const [cityId, list] of Object.entries(catalog.byCity)) {
  sortedByCity[cityId] = [...list].sort((a, b) => a.priceRub - b.priceRub);
}

export function getHousingPropertiesForCity(cityId: string): HousingPropertyDef[] {
  return sortedByCity[cityId] ?? [];
}

export function getHousingProperty(cityId: string, propertyId: string): HousingPropertyDef | undefined {
  return getHousingPropertiesForCity(cityId).find((p) => p.id === propertyId);
}

export function housingPropertyLabel(p: HousingPropertyDef): string {
  return `${p.title} (${p.district})`;
}

export function listAllCitiesWithProperties(): string[] {
  return Object.keys(catalog.byCity);
}

export function getCityHousingMultiplier(cityId: string): number {
  return getCityEconomyMultiplier(cityId);
}

const moodBonusByTypeKey = new Map(
  (catalog.propertyTypes ?? []).map((t) => [t.key, t.moodBonus] as const),
);

/** Бонус настроения по типу жилья из каталога (как в карточках недвижимости). */
export function housingTypeMoodBonus(typeKey: string): number {
  return moodBonusByTypeKey.get(typeKey) ?? 0;
}
