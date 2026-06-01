import type { PlayerRow } from "./db.js";
import { getPlayer, updatePlayer } from "./db.js";
import { computeResaleValue } from "./assetTrade.js";
import { appendCityFeed, feedActorName } from "./cityFeed.js";
import {
  getCar,
  getCarCategories,
  getCarsByCategory,
  type CarModel,
} from "./gameData.js";
import {
  deletePlayerCars,
  getPlayerCarById,
  hasDriverLicense,
  insertPlayerCar,
  listPlayerCars,
  parseDriverLicenses,
  tradeInValueForPlayerCar,
} from "./playerCars.js";
import { formatVehiclePlate, parsePlatePartsFromRow } from "./licensePlate.js";
import type { PlayerCarRow } from "./playerCars.js";
import { getCarShopPriceRub } from "./shopCatalog.js";

function plateTextForCarRow(row: PlayerCarRow): string | null {
  if (row.plate_text) return row.plate_text;
  const parts = parsePlatePartsFromRow(row);
  return parts ? formatVehiclePlate(parts) : null;
}

export type AssetQuote = {
  listPriceRub: number;
  tradeInRub: number;
  netPriceRub: number;
  resaleRatePct: number;
  tradeInCatalogPriceRub: number | null;
};

export type OwnedCarView = {
  id: number;
  modelId: string;
  brand: string;
  model: string;
  accent: string;
  year: number;
  body: string;
  plateText: string | null;
  tradeInRub: number;
};

export type CarCatalogItem = CarModel & {
  isOwned: boolean;
  ownedCount: number;
  hasLicense: boolean;
  licenseCategory: string;
  payFromRub: number | null;
  payToRub: number | null;
  singleTradeInRub: number | null;
};

function playerOwnsModel(userId: number, carId: string): boolean {
  return listPlayerCars(userId).some((r) => r.car_model_id === carId);
}

export type CarPurchaseQuote = {
  listPriceRub: number;
  tradeInRub: number;
  netPriceRub: number;
  excessRub: number;
  tradeInCars: { id: number; modelName: string; amountRub: number }[];
};

export function listCarCategoriesWithCounts() {
  const owned = new Set<string>();
  return getCarCategories().map((cat) => ({
    ...cat,
    carCount: getCarsByCategory(cat.id).length,
  }));
}

function ownedModelCounts(userId: number): Map<string, number> {
  const m = new Map<string, number>();
  for (const row of listPlayerCars(userId)) {
    m.set(row.car_model_id, (m.get(row.car_model_id) ?? 0) + 1);
  }
  return m;
}

function tradeInValuesForOwned(userId: number, now: number): number[] {
  return listPlayerCars(userId)
    .map((row) => tradeInValueForPlayerCar(row, now))
    .filter((v): v is number => v != null);
}

export function listCarsInCategory(
  player: PlayerRow,
  categoryId: string,
  now = Date.now(),
): CarCatalogItem[] {
  const userId = player.user_id;
  const owned = ownedModelCounts(userId);
  const tradeValues = tradeInValuesForOwned(userId, now);
  const sumTrade = tradeValues.reduce((a, b) => a + b, 0);
  const minSingleTrade = tradeValues.length ? Math.min(...tradeValues) : 0;

  return getCarsByCategory(categoryId).map((c) => {
    const listPriceRub = c.priceRub;
    let payFromRub: number | null = null;
    let payToRub: number | null = null;

    if (tradeValues.length >= 1) {
      payFromRub = Math.max(0, listPriceRub - sumTrade);
      payToRub = Math.max(0, listPriceRub - minSingleTrade);
    }

    return {
      ...c,
      isOwned: (owned.get(c.id) ?? 0) > 0,
      ownedCount: owned.get(c.id) ?? 0,
      hasLicense: hasDriverLicense(player, c.licenseCategory),
      licenseCategory: c.licenseCategory,
      payFromRub,
      payToRub,
      singleTradeInRub: null,
    };
  });
}

export function listOwnedCars(player: PlayerRow, now = Date.now()): OwnedCarView[] {
  return listPlayerCars(player.user_id)
    .map((row) => {
      const car = getCar(row.car_model_id);
      if (!car) return null;
      const tradeInRub = tradeInValueForPlayerCar(row, now) ?? 0;
      return {
        id: row.id,
        modelId: row.car_model_id,
        brand: car.brand,
        model: car.model,
        accent: car.accent,
        year: car.year,
        body: car.body,
        plateText: row.plate_text,
        tradeInRub,
      };
    })
    .filter((x): x is OwnedCarView => x != null);
}

export function quoteCarPurchase(
  player: PlayerRow,
  carId: string,
  tradeInCarIds: number[] = [],
  now = Date.now(),
): CarPurchaseQuote | { error: string } {
  const listPriceRub = getCarShopPriceRub(carId);
  if (listPriceRub == null) return { error: "Модель не найдена" };
  const car = getCar(carId);
  if (!car) return { error: "Модель не найдена" };

  const tradeInCars: CarPurchaseQuote["tradeInCars"] = [];
  let tradeInRub = 0;
  const seen = new Set<number>();

  for (const pid of tradeInCarIds) {
    if (seen.has(pid)) continue;
    seen.add(pid);
    const row = getPlayerCarById(player.user_id, pid);
    if (!row) return { error: "Автомобиль для зачёта не найден" };
    const amountRub = tradeInValueForPlayerCar(row, now);
    if (amountRub == null) return { error: "Не удалось оценить автомобиль для зачёта" };
    const c = getCar(row.car_model_id);
    tradeInRub += amountRub;
    tradeInCars.push({
      id: row.id,
      modelName: c ? `${c.brand} ${c.model}` : row.car_model_id,
      amountRub,
    });
  }

  const netPriceRub = listPriceRub - tradeInRub;
  const excessRub = netPriceRub < 0 ? -netPriceRub : 0;
  const dueRub = Math.max(0, netPriceRub);

  return {
    listPriceRub,
    tradeInRub,
    netPriceRub: dueRub,
    excessRub,
    tradeInCars,
  };
}

function requireLicense(player: PlayerRow, carId: string): string | null {
  const car = getCar(carId);
  if (!car) return "Модель не найдена";
  if (!hasDriverLicense(player, car.licenseCategory)) {
    return `Нужны права категории ${car.licenseCategory}`;
  }
  return null;
}

export function buyCar(
  userId: number,
  carId: string,
): { ok: true; carName: string } | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  const licErr = requireLicense(player, carId);
  if (licErr) return { ok: false, error: licErr };
  const car = getCar(carId);
  if (!car) return { ok: false, error: "Модель не найдена" };
  if (playerOwnsModel(userId, carId)) {
    return { ok: false, error: "Эта модель уже куплена" };
  }
  const listPriceRub = car.priceRub;
  if (player.rubles < listPriceRub) {
    return { ok: false, error: `Нужно ${listPriceRub.toLocaleString("ru-RU")} ₽` };
  }
  const now = Date.now();
  updatePlayer(userId, { rubles: player.rubles - listPriceRub });
  insertPlayerCar(userId, carId, now);
  const name = feedActorName(userId);
  const carName = `${car.brand} ${car.model}`;
  appendCityFeed(player.city_id, "shop:car", `${name} купил ${carName}`, userId);
  return { ok: true, carName };
}

export function tradeInForCar(
  userId: number,
  carId: string,
  tradeInCarIds: number[],
): { ok: true; carName: string; excessRub: number } | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  const licErr = requireLicense(player, carId);
  if (licErr) return { ok: false, error: licErr };
  if (tradeInCarIds.length === 0) {
    return { ok: false, error: "Выберите хотя бы один автомобиль для зачёта" };
  }
  if (playerOwnsModel(userId, carId)) {
    return { ok: false, error: "Эта модель уже куплена" };
  }
  const quote = quoteCarPurchase(player, carId, tradeInCarIds);
  if ("error" in quote) return { ok: false, error: quote.error };
  if (player.rubles < quote.netPriceRub) {
    return { ok: false, error: `Нужно ${quote.netPriceRub.toLocaleString("ru-RU")} ₽` };
  }
  const car = getCar(carId);
  if (!car) return { ok: false, error: "Модель не найдена" };
  const now = Date.now();
  deletePlayerCars(userId, tradeInCarIds);
  updatePlayer(userId, {
    rubles: player.rubles - quote.netPriceRub + quote.excessRub,
  });
  insertPlayerCar(userId, carId, now);
  const name = feedActorName(userId);
  const carName = `${car.brand} ${car.model}`;
  appendCityFeed(
    player.city_id,
    "shop:car",
    `${name} обменял авто на ${carName}`,
    userId,
  );
  return { ok: true, carName, excessRub: quote.excessRub };
}

export function quoteCarSell(
  player: PlayerRow,
  playerCarId: number,
  now = Date.now(),
):
  | { amountRub: number; catalogPriceRub: number; carName: string; plateText: string | null }
  | { error: string } {
  const row = getPlayerCarById(player.user_id, playerCarId);
  if (!row) return { error: "Автомобиль не найден" };
  const catalogPriceRub = getCarShopPriceRub(row.car_model_id);
  if (catalogPriceRub == null) return { error: "Модель не найдена в каталоге" };
  const car = getCar(row.car_model_id);
  return {
    catalogPriceRub,
    amountRub: computeResaleValue(catalogPriceRub, "car", row.acquired_at, now, "sell"),
    carName: car ? `${car.brand} ${car.model}` : row.car_model_id,
    plateText: plateTextForCarRow(row),
  };
}

export function sellCar(
  userId: number,
  playerCarId: number,
): { ok: true; amountRub: number } | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  const row = getPlayerCarById(userId, playerCarId);
  if (!row) return { ok: false, error: "Автомобиль не найден" };
  const sell = quoteCarSell(player, playerCarId);
  if ("error" in sell) return { ok: false, error: sell.error };
  deletePlayerCars(userId, [playerCarId]);
  updatePlayer(userId, { rubles: player.rubles + sell.amountRub });
  const name = feedActorName(userId);
  appendCityFeed(
    player.city_id,
    "shop:car",
    `${name} продал авто (+${sell.amountRub.toLocaleString("ru-RU")} ₽)`,
    userId,
  );
  return { ok: true, amountRub: sell.amountRub };
}

/** @deprecated use listCarsInCategory */
export function listCarCatalog(player: PlayerRow, now = Date.now()) {
  return listCarsInCategory(player, "B", now);
}
