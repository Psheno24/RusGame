import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "./db.js";
import {
  getCarCityPriceRub,
  getCarClassLabel,
  getCityCarMarketLevel,
  getMaxCarClassForMarketLevel,
} from "./carMarket.js";
import { getCar, getCars, type CarModel } from "./gameData.js";
import type { PlayerCarCondition } from "./playerCars.js";

export type UsedCarCondition = PlayerCarCondition;

const DATA_DIR = join(import.meta.dirname, "../../../data");

type UsedCarMarketConfig = {
  refreshIntervalMs: number;
  usedMaxClassOffset: number;
  listingCountByCity: Record<string, [number, number]>;
  listingCountByMarketLevel: Record<string, [number, number]>;
  mileageKmRanges: [number, number, number][];
  mileageWearMultiplier: [number, number, number][];
  priceTierWeights: { tier: string; weight: number; minPct: number; maxPct: number }[];
  diagnoseCostPct: { min: number; max: number };
  diagnoseAccuracy: {
    tightChance: number;
    tightHalfWidth: number;
    looseHalfWidthMin: number;
    looseHalfWidthMax: number;
  };
};

const config = JSON.parse(
  readFileSync(join(DATA_DIR, "usedCarMarket.json"), "utf-8"),
) as UsedCarMarketConfig;

const CLASS_ORDER = [
  "economy",
  "comfort",
  "comfort_plus",
  "business",
  "premium",
  "luxury",
  "hypercar",
] as const;

export type UsedCarListing = {
  id: string;
  carModelId: string;
  mileageKm: number;
  condition: UsedCarCondition;
  /** Оценка для витрины (может завышать реальное состояние). */
  overallVisible: number;
  priceRub: number;
  newPriceRub: number;
  /** Фиксируется при генерации рынка; старые записи без поля — детерминированный fallback. */
  diagnoseCostRub?: number;
};

export type UsedCarDiagnosisRanges = {
  engine: { min: number; max: number };
  tires: { min: number; max: number };
  alignment: { min: number; max: number };
  electronics: { min: number; max: number };
  body: { min: number; max: number };
  interior: { min: number; max: number };
};

type CityMarketRow = {
  city_id: string;
  refreshed_at: number;
  listings_json: string;
};

function classIndex(carClass: string): number {
  const i = CLASS_ORDER.indexOf(carClass as (typeof CLASS_ORDER)[number]);
  return i >= 0 ? i : 0;
}

export function getMaxUsedCarClassForCity(cityId: string): string {
  const level = getCityCarMarketLevel(cityId);
  const salonMax = getMaxCarClassForMarketLevel(level);
  const idx = Math.min(
    CLASS_ORDER.length - 1,
    classIndex(salonMax) + config.usedMaxClassOffset,
  );
  return CLASS_ORDER[idx];
}

export function isCarClassOnUsedMarket(cityId: string, carClass: string): boolean {
  const maxUsed = getMaxUsedCarClassForCity(cityId);
  return classIndex(carClass) <= classIndex(maxUsed);
}

export function getUsedMarketRefreshIntervalMs(): number {
  return config.refreshIntervalMs;
}

export function getMileageWearMultiplier(mileageKm: number): number {
  for (const [from, to, mult] of config.mileageWearMultiplier) {
    if (mileageKm >= from && mileageKm < to) return mult;
  }
  return 1.8;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function randFloat(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function pickWeighted<T extends { weight: number }>(rng: () => number, items: T[]): T {
  const total = items.reduce((s, x) => s + x.weight, 0);
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1]!;
}

function listingCountForCity(cityId: string, refreshSlot: number): number {
  const override = config.listingCountByCity[cityId];
  const level = getCityCarMarketLevel(cityId);
  const range =
    override ?? config.listingCountByMarketLevel[String(level)] ?? [6, 10];
  const rng = mulberry32(hashCitySlot(cityId, refreshSlot) ^ 0x9e3779b9);
  return randInt(rng, range[0], range[1]);
}

function hashListingId(listingId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < listingId.length; i++) {
    h ^= listingId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Стабильная стоимость диагностики для объявления (не меняется между запросами). */
export function listingDiagnoseCostRub(listing: UsedCarListing): number {
  if (listing.diagnoseCostRub != null && listing.diagnoseCostRub > 0) {
    return listing.diagnoseCostRub;
  }
  const rng = mulberry32(hashListingId(listing.id) ^ 0xd1a90e01);
  return diagnoseCostRub(listing.priceRub, rng);
}

function hashCitySlot(cityId: string, slot: number): number {
  let h = slot;
  for (let i = 0; i < cityId.length; i++) {
    h = (h * 31 + cityId.charCodeAt(i)) >>> 0;
  }
  return h;
}

function currentRefreshSlot(now: number): number {
  return Math.floor(now / config.refreshIntervalMs);
}

function nextRefreshAt(now: number): number {
  return (currentRefreshSlot(now) + 1) * config.refreshIntervalMs;
}

function rollMileageKm(rng: () => number): number {
  const tiers = config.mileageKmRanges.map(([from, to, weight]) => ({ from, to, weight }));
  const tier = pickWeighted(rng, tiers);
  return randInt(rng, tier.from, tier.to);
}

function rollCondition(rng: () => number, mileageKm: number): UsedCarCondition {
  const wearBias = Math.min(35, Math.floor(mileageKm / 12000));
  const part = () => Math.max(5, Math.min(98, randInt(rng, 25, 95) - randInt(rng, 0, wearBias)));
  return {
    engine: part(),
    transmission: part(),
    tires: part(),
    alignment: part(),
    body: part(),
    electronics: part(),
    interior: part(),
  };
}

function visibleOverall(condition: UsedCarCondition, rng: () => number): number {
  const realAvg = Math.round(
    (condition.body + condition.interior + condition.tires + condition.alignment) / 4,
  );
  const optimism = randInt(rng, -8, 18);
  return Math.max(10, Math.min(99, realAvg + optimism));
}

function conditionPriceFactor(condition: UsedCarCondition, mileageKm: number): number {
  const avg =
    (condition.engine +
      condition.transmission +
      condition.tires +
      condition.alignment +
      condition.body +
      condition.electronics +
      condition.interior) /
    7;
  const mileagePenalty = Math.min(0.22, mileageKm / 2_500_000);
  return 0.55 + (avg / 100) * 0.38 - mileagePenalty;
}

function rollPriceRub(
  rng: () => number,
  newPriceRub: number,
  condition: UsedCarCondition,
  mileageKm: number,
): number {
  const tier = pickWeighted(rng, config.priceTierWeights);
  const tierPct = randFloat(rng, tier.minPct, tier.maxPct);
  const condFactor = conditionPriceFactor(condition, mileageKm);
  return Math.max(50_000, Math.round(newPriceRub * tierPct * condFactor));
}

function eligibleCarsForCity(cityId: string): CarModel[] {
  return getCars().filter((c) => isCarClassOnUsedMarket(cityId, c.carClass ?? "economy"));
}

export function generateCityListings(cityId: string, refreshedAt: number): UsedCarListing[] {
  const slot = Math.floor(refreshedAt / config.refreshIntervalMs);
  const rng = mulberry32(hashCitySlot(cityId, slot));
  const pool = eligibleCarsForCity(cityId);
  if (pool.length === 0) return [];

  const count = listingCountForCity(cityId, slot);
  const listings: UsedCarListing[] = [];
  const usedModels = new Set<string>();

  for (let i = 0; i < count; i++) {
    let car: CarModel | undefined;
    for (let attempt = 0; attempt < 24; attempt++) {
      const pick = pool[randInt(rng, 0, pool.length - 1)]!;
      if (!usedModels.has(pick.id) || attempt > 12) {
        car = pick;
        break;
      }
    }
    if (!car) car = pool[randInt(rng, 0, pool.length - 1)]!;
    usedModels.add(car.id);

    const mileageKm = rollMileageKm(rng);
    const condition = rollCondition(rng, mileageKm);
    const newPriceRub = getCarCityPriceRub(cityId, car);
    const priceRub = rollPriceRub(rng, newPriceRub, condition, mileageKm);
    const diagnoseCost = diagnoseCostRub(priceRub, rng);

    listings.push({
      id: `${cityId}-${refreshedAt}-${i}`,
      carModelId: car.id,
      mileageKm,
      condition,
      overallVisible: visibleOverall(condition, rng),
      priceRub,
      newPriceRub,
      diagnoseCostRub: diagnoseCost,
    });
  }

  return listings;
}

function parseListings(json: string): UsedCarListing[] {
  try {
    const parsed = JSON.parse(json) as UsedCarListing[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadCityRow(cityId: string): CityMarketRow | undefined {
  return getDb()
    .prepare("SELECT city_id, refreshed_at, listings_json FROM city_used_car_markets WHERE city_id = ?")
    .get(cityId) as CityMarketRow | undefined;
}

function saveCityRow(cityId: string, refreshedAt: number, listings: UsedCarListing[]) {
  getDb()
    .prepare(
      `INSERT INTO city_used_car_markets (city_id, refreshed_at, listings_json)
       VALUES (?, ?, ?)
       ON CONFLICT(city_id) DO UPDATE SET refreshed_at = excluded.refreshed_at, listings_json = excluded.listings_json`,
    )
    .run(cityId, refreshedAt, JSON.stringify(listings));
}

export function ensureCityUsedMarket(cityId: string, now = Date.now()): {
  refreshedAt: number;
  nextRefreshAt: number;
  listings: UsedCarListing[];
} {
  const slotStart = currentRefreshSlot(now) * config.refreshIntervalMs;
  const row = loadCityRow(cityId);
  if (row && row.refreshed_at >= slotStart) {
    return {
      refreshedAt: row.refreshed_at,
      nextRefreshAt: nextRefreshAt(now),
      listings: parseListings(row.listings_json),
    };
  }
  const listings = generateCityListings(cityId, slotStart);
  saveCityRow(cityId, slotStart, listings);
  return {
    refreshedAt: slotStart,
    nextRefreshAt: nextRefreshAt(now),
    listings,
  };
}

export function getCityListing(
  cityId: string,
  listingId: string,
  now = Date.now(),
): UsedCarListing | undefined {
  const market = ensureCityUsedMarket(cityId, now);
  return market.listings.find((l) => l.id === listingId);
}

export function removeCityListing(cityId: string, listingId: string, now = Date.now()): boolean {
  const row = loadCityRow(cityId);
  if (!row) return false;
  const listings = parseListings(row.listings_json).filter((l) => l.id !== listingId);
  if (listings.length === parseListings(row.listings_json).length) return false;
  saveCityRow(cityId, row.refreshed_at, listings);
  return true;
}

export function diagnoseCostRub(priceRub: number, rng: () => number = Math.random): number {
  const pct = randFloat(rng, config.diagnoseCostPct.min, config.diagnoseCostPct.max);
  return Math.max(500, Math.round(priceRub * pct));
}

export function buildDiagnosisRanges(
  condition: UsedCarCondition,
  rng: () => number = Math.random,
): UsedCarDiagnosisRanges {
  const rangeFor = (actual: number) => {
    const tight = rng() < config.diagnoseAccuracy.tightChance;
    const half = tight
      ? config.diagnoseAccuracy.tightHalfWidth
      : randInt(
          rng,
          config.diagnoseAccuracy.looseHalfWidthMin,
          config.diagnoseAccuracy.looseHalfWidthMax,
        );
    const min = Math.max(0, actual - half);
    const max = Math.min(100, actual + half);
    return { min, max };
  };
  return {
    engine: rangeFor(condition.engine),
    tires: rangeFor(condition.tires),
    alignment: rangeFor(condition.alignment),
    electronics: rangeFor(condition.electronics),
    body: rangeFor(condition.body),
    interior: rangeFor(condition.interior),
  };
}

export function getUsedCarClassLabel(carClass: string): string {
  return getCarClassLabel(carClass);
}

export function formatMileageKm(km: number): string {
  return `${km.toLocaleString("ru-RU")} км`;
}
