import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./config.js";

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

type HousingPropertiesFile = {
  version?: number;
  cityMultipliers?: Record<string, number>;
  byCity: Record<string, HousingPropertyDef[]>;
};

const catalog = JSON.parse(
  readFileSync(join(DATA_DIR, "housingProperties.json"), "utf-8"),
) as HousingPropertiesFile;

export function getHousingPropertiesForCity(cityId: string): HousingPropertyDef[] {
  const cityList = catalog.byCity[cityId];
  if (!cityList?.length) return [];
  return [...cityList].sort((a, b) => a.priceRub - b.priceRub);
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
  return catalog.cityMultipliers?.[cityId] ?? 1;
}
