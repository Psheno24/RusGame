import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./config.js";

export type BalanceBible = {
  skills: {
    progressEvery: number;
    ranks: { key: string; title: string; min: number; max: number | null }[];
  };
  reputation: { min: number; max: number; shiftGain: number };
  mood: {
    min: number;
    max: number;
    default: number;
    cityTierBonus: Record<string, number>;
    sideJobPenalty: number;
    energyCostMultiplier: {
      lowMax: number;
      lowMult: number;
      midMax: number;
      midMult: number;
      highMult: number;
    };
  };
  housingMoodBonus: Record<string, number>;
  carMoodBonus: Record<string, number>;
  energy: {
    max: number;
    workCosts: Record<string, number>;
    sleepFullMs: number;
  };
  cityTiers: Record<string, string[]>;
  cityMultipliers: Record<string, number>;
  housingOmskBase: Record<string, unknown>;
  housingTypeMap: Record<string, string>;
  sublet: {
    incomePctMin: number;
    incomePctMax: number;
    vacancyChance: number;
    renewChance: number;
  };
  fuel: Record<string, number>;
  wearPctPer100Km: Record<string, number>;
  wearMileageMult: { fromKm: number; mult: number }[];
  repairGrantaBase: Record<string, number>;
  repairModelMult: Record<string, number>;
  usedMarket: Record<string, unknown>;
  delivery: Record<string, unknown>;
  taxi: Record<string, unknown>;
  jobs: Record<string, unknown>;
  education: Record<string, { cost: number; days: number; key: string; reputationGain?: number }>;
  career: {
    levels: {
      key: string;
      title: string;
      rank: number;
      payoutBase: number;
      skillMin: number;
      reputationMin: number;
      daysMin: number;
      education: string;
    }[];
    cooldownHours: number;
  };
};

let cached: BalanceBible | null = null;

export function getBalanceBible(): BalanceBible {
  if (!cached) {
    cached = JSON.parse(
      readFileSync(join(DATA_DIR, "balanceBible.json"), "utf-8"),
    ) as BalanceBible;
  }
  return cached;
}

export function getCityEconomyTier(cityId: string): number {
  const bible = getBalanceBible();
  for (const [tier, cities] of Object.entries(bible.cityTiers)) {
    if (cities.includes(cityId)) return Number(tier);
  }
  return 3;
}

export function getCityEconomyMultiplier(cityId: string): number {
  return getBalanceBible().cityMultipliers[cityId] ?? 1;
}

export function getSkillRank(level: number): { key: string; title: string } {
  const ranks = getBalanceBible().skills.ranks;
  for (const r of ranks) {
    if (level >= r.min && (r.max == null || level <= r.max)) {
      return { key: r.key, title: r.title };
    }
  }
  return { key: "master", title: "Мастер" };
}

export function moodEnergyCostMultiplier(mood: number): number {
  const cfg = getBalanceBible().mood.energyCostMultiplier;
  if (mood <= cfg.lowMax) return cfg.lowMult;
  if (mood <= cfg.midMax) return cfg.midMult;
  return cfg.highMult;
}

export function clampBibleMood(value: number): number {
  const { min, max } = getBalanceBible().mood;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function cityTierMoodBonus(cityId: string): number {
  const tier = getCityEconomyTier(cityId);
  return getBalanceBible().mood.cityTierBonus[String(tier)] ?? 0;
}

export function housingBibleTypeKey(typeKey: string): string {
  return getBalanceBible().housingTypeMap[typeKey] ?? typeKey;
}

export function housingBibleMoodBonus(typeKey: string): number {
  const mapped = housingBibleTypeKey(typeKey);
  return getBalanceBible().housingMoodBonus[mapped] ?? 0;
}

export function carBibleMoodBonus(modelId: string): number {
  return getBalanceBible().carMoodBonus[modelId] ?? 0;
}

export function housingBuyPriceRub(cityId: string, typeKey: string): number | null {
  const bible = getBalanceBible();
  const mapped = housingBibleTypeKey(typeKey);
  if (mapped === "dorm") return null;
  const base = bible.housingOmskBase[mapped] as { buy: number; rent: number } | undefined;
  if (!base) return null;
  return Math.round(base.buy * getCityEconomyMultiplier(cityId));
}

export function housingRentPriceRub(cityId: string, typeKey: string): number | null {
  const bible = getBalanceBible();
  const mapped = housingBibleTypeKey(typeKey);
  const mult = getCityEconomyMultiplier(cityId);
  if (mapped === "dorm") {
    return Math.round((bible.housingOmskBase.dormRentMonthly as number) * mult);
  }
  const base = bible.housingOmskBase[mapped] as { buy: number; rent: number } | undefined;
  if (!base) return null;
  return Math.round(base.rent * mult);
}

export function subletMonthlyIncomeRub(propertyPriceRub: number): number {
  const { incomePctMin, incomePctMax } = getBalanceBible().sublet;
  const pct = incomePctMin + Math.random() * (incomePctMax - incomePctMin);
  return Math.round(propertyPriceRub * pct);
}

export function workEnergyCost(templateKey: string): number {
  return getBalanceBible().energy.workCosts[templateKey] ?? 0;
}

export function scaledWorkEnergyCost(templateKey: string, mood: number): number {
  const base = workEnergyCost(templateKey);
  return Math.max(1, Math.round(base * moodEnergyCostMultiplier(mood)));
}
