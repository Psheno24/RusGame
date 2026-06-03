import type { PlayerRow } from "./db.js";
import { getDb, getPlayer, updatePlayer } from "./db.js";
import { getCarClassLabel } from "./carMarket.js";
import { getCar } from "./gameData.js";
import { appendPlayerFeed } from "./playerFeed.js";
import {
  getPlayerCarById,
  getPlayerCarCondition,
  hasDriverLicense,
  insertUsedPlayerCar,
} from "./playerCars.js";
import {
  buildDiagnosisRanges,
  diagnoseCostRub,
  ensureCityUsedMarket,
  formatMileageKm,
  getCityListing,
  getMaxUsedCarClassForCity,
  getUsedCarClassLabel,
  removeCityListing,
  type UsedCarCondition,
  type UsedCarDiagnosisRanges,
  type UsedCarListing,
} from "./usedCarMarket.js";

export type UsedCarListingView = {
  id: string;
  carModelId: string;
  brand: string;
  model: string;
  accent: string;
  year: number;
  body: string;
  carClassLabel: string;
  licenseCategory: string;
  hasLicense: boolean;
  mileageKm: number;
  mileageLabel: string;
  bodyCondition: number;
  overallVisible: number;
  priceRub: number;
  newPriceRub: number;
  priceVsNewPct: number;
  diagnosed: boolean;
  diagnosis: UsedCarDiagnosisRanges | null;
  diagnoseCostRub: number;
};

export type UsedCarMarketView = {
  refreshedAt: number;
  nextRefreshAt: number;
  maxClassLabel: string;
  listings: UsedCarListingView[];
};

function getDiagnosis(
  userId: number,
  listingId: string,
): UsedCarDiagnosisRanges | null {
  const row = getDb()
    .prepare(
      `SELECT ranges_json FROM used_car_diagnostics WHERE user_id = ? AND listing_id = ?`,
    )
    .get(userId, listingId) as { ranges_json: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.ranges_json) as UsedCarDiagnosisRanges;
  } catch {
    return null;
  }
}

function saveDiagnosis(userId: number, listingId: string, ranges: UsedCarDiagnosisRanges, now: number) {
  getDb()
    .prepare(
      `INSERT INTO used_car_diagnostics (user_id, listing_id, diagnosed_at, ranges_json)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, listing_id) DO UPDATE SET diagnosed_at = excluded.diagnosed_at, ranges_json = excluded.ranges_json`,
    )
    .run(userId, listingId, now, JSON.stringify(ranges));
}

function toListingView(
  player: PlayerRow,
  listing: UsedCarListing,
  diagnosis: UsedCarDiagnosisRanges | null,
): UsedCarListingView | null {
  const car = getCar(listing.carModelId);
  if (!car) return null;
  const cls = car.carClass ?? "economy";
  return {
    id: listing.id,
    carModelId: listing.carModelId,
    brand: car.brand,
    model: car.model,
    accent: car.accent,
    year: car.year,
    body: car.body,
    carClassLabel: getUsedCarClassLabel(cls),
    licenseCategory: car.licenseCategory,
    hasLicense: hasDriverLicense(player, car.licenseCategory),
    mileageKm: listing.mileageKm,
    mileageLabel: formatMileageKm(listing.mileageKm),
    bodyCondition: listing.condition.body,
    overallVisible: listing.overallVisible,
    priceRub: listing.priceRub,
    newPriceRub: listing.newPriceRub,
    priceVsNewPct: Math.round((listing.priceRub / listing.newPriceRub) * 100),
    diagnosed: diagnosis != null,
    diagnosis,
    diagnoseCostRub: diagnoseCostRub(listing.priceRub),
  };
}

export function getUsedCarMarket(player: PlayerRow, now = Date.now()): UsedCarMarketView {
  const cityId = player.city_id;
  const market = ensureCityUsedMarket(cityId, now);
  const listings = market.listings
    .map((l) => toListingView(player, l, getDiagnosis(player.user_id, l.id)))
    .filter((x): x is UsedCarListingView => x != null);

  return {
    refreshedAt: market.refreshedAt,
    nextRefreshAt: market.nextRefreshAt,
    maxClassLabel: getCarClassLabel(getMaxUsedCarClassForCity(cityId)),
    listings,
  };
}

export function getUsedCarListingDetail(
  player: PlayerRow,
  listingId: string,
  now = Date.now(),
): UsedCarListingView | { error: string } {
  const listing = getCityListing(player.city_id, listingId, now);
  if (!listing) return { error: "Объявление снято с продажи или рынок обновился" };
  const view = toListingView(player, listing, getDiagnosis(player.user_id, listingId));
  if (!view) return { error: "Модель не найдена" };
  return view;
}

export function diagnoseUsedCar(
  userId: number,
  listingId: string,
  now = Date.now(),
): { ok: true; diagnosis: UsedCarDiagnosisRanges; costRub: number } | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  const listing = getCityListing(player.city_id, listingId, now);
  if (!listing) return { ok: false, error: "Автомобиль уже продан или рынок обновился" };

  const existing = getDiagnosis(userId, listingId);
  if (existing) {
    return { ok: true, diagnosis: existing, costRub: 0 };
  }

  const costRub = diagnoseCostRub(listing.priceRub);
  if (player.rubles < costRub) {
    return { ok: false, error: `Нужно ${costRub.toLocaleString("ru-RU")} ₽ за диагностику` };
  }

  const diagnosis = buildDiagnosisRanges(listing.condition);
  updatePlayer(userId, { rubles: player.rubles - costRub });
  saveDiagnosis(userId, listingId, diagnosis, now);
  appendPlayerFeed(
    userId,
    "shop:car",
    `Диагностика б/у авто (−${costRub.toLocaleString("ru-RU")} ₽)`,
    now,
  );
  return { ok: true, diagnosis, costRub };
}

export function buyUsedCar(
  userId: number,
  listingId: string,
  now = Date.now(),
): { ok: true; carName: string; playerCarId: number; condition: UsedCarCondition } | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  const listing = getCityListing(player.city_id, listingId, now);
  if (!listing) return { ok: false, error: "Автомобиль уже продан или рынок обновился" };

  const car = getCar(listing.carModelId);
  if (!car) return { ok: false, error: "Модель не найдена" };
  if (!hasDriverLicense(player, car.licenseCategory)) {
    return { ok: false, error: `Нужны права категории ${car.licenseCategory}` };
  }
  if (player.rubles < listing.priceRub) {
    return { ok: false, error: `Нужно ${listing.priceRub.toLocaleString("ru-RU")} ₽` };
  }

  if (!removeCityListing(player.city_id, listingId, now)) {
    return { ok: false, error: "Автомобиль уже куплен другим игроком" };
  }

  updatePlayer(userId, { rubles: player.rubles - listing.priceRub });
  const playerCarId = insertUsedPlayerCar(
    userId,
    listing.carModelId,
    now,
    listing.priceRub,
    listing.mileageKm,
    listing.condition,
  );
  const carName = `${car.brand} ${car.model}`;
  appendPlayerFeed(
    userId,
    "shop:car",
    `Купили б/у: ${carName} (${formatMileageKm(listing.mileageKm)})`,
    now,
  );
  return { ok: true, carName, playerCarId, condition: listing.condition };
}

export type OwnedUsedCarCondition = {
  playerCarId: number;
  mileageKm: number;
  mileageLabel: string;
  condition: UsedCarCondition;
};

export function getOwnedCarCondition(
  userId: number,
  playerCarId: number,
): OwnedUsedCarCondition | { error: string } {
  const row = getPlayerCarById(userId, playerCarId);
  if (!row || !row.is_used) return { error: "Нет данных о состоянии" };
  const mileageKm = row.mileage_km ?? 0;
  return {
    playerCarId: row.id,
    mileageKm,
    mileageLabel: formatMileageKm(mileageKm),
    condition: getPlayerCarCondition(row),
  };
}
