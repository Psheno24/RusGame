import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { HousingType, PlayerRow } from "./db.js";
import { updatePlayer } from "./db.js";
import { computeResaleValue } from "./assetTrade.js";
import { DATA_DIR } from "./config.js";
import { getCity } from "./gameData.js";
import {
  getHousingPropertiesForCity,
  getHousingProperty,
  housingPropertyLabel,
} from "./housingCatalog.js";

function ownsApartmentInCity(player: PlayerRow, cityId: string): boolean {
  return player.housing_type === "owned" && player.housing_city_id === cityId;
}

type HousingConfig = {
  byTier: Record<string, { dormRub: number; rentRub: number; buyRub: number }>;
  dormHours: number;
  rentDays: number;
  starterDormDays: number;
};

const config = JSON.parse(readFileSync(join(DATA_DIR, "housing.json"), "utf-8")) as HousingConfig;

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;

export function getHousingPrices(cityId: string) {
  const city = getCity(cityId);
  const tier = String(city?.tier ?? 2);
  const prices = config.byTier[tier] ?? config.byTier["2"]!;
  return {
    tier: city?.tier ?? 2,
    dormRub: prices.dormRub,
    rentRub: prices.rentRub,
    buyRub: prices.buyRub,
    dormHours: config.dormHours,
    rentDays: config.rentDays,
  };
}

export function isCityResident(player: PlayerRow, cityId?: string, now = Date.now()): boolean {
  const cid = cityId ?? player.city_id;
  if (!player.housing_type || !player.housing_city_id) return false;
  if (player.housing_city_id !== cid) return false;
  if (player.housing_type === "owned") return true;
  if (player.housing_type === "dorm" || player.housing_type === "rent") {
    return player.housing_expires_at != null && player.housing_expires_at > now;
  }
  return false;
}

export function housingStatusForPlayer(player: PlayerRow, now = Date.now()) {
  const inCity = player.city_id;
  const resident = isCityResident(player, inCity, now);
  const activeInCurrent =
    player.housing_city_id === inCity &&
    (player.housing_type === "owned" ||
      (player.housing_expires_at != null && player.housing_expires_at > now));

  let label = "Гость";
  let expiresAt: number | null = null;
  if (activeInCurrent && player.housing_type === "owned") {
    const prop =
      player.housing_property_id && player.housing_city_id
        ? getHousingProperty(player.housing_city_id, player.housing_property_id)
        : undefined;
    label = prop ? `Житель · ${housingPropertyLabel(prop)}` : "Житель (своё жильё)";
  } else if (activeInCurrent && player.housing_expires_at) {
    label = "Житель";
    expiresAt = player.housing_expires_at;
  } else if (player.housing_city_id && player.housing_city_id !== inCity) {
    const other = getCity(player.housing_city_id);
    label = `Жильё в ${other?.name ?? player.housing_city_id} — здесь вы гость`;
  }

  return {
    isResident: resident,
    housingType: player.housing_type as HousingType | null,
    housingCityId: player.housing_city_id,
    housingExpiresAt: player.housing_expires_at,
    statusLabel: label,
    expiresAt,
  };
}

function extendExpiry(current: number | null, addMs: number, now: number): number {
  const base = current != null && current > now ? current : now;
  return base + addMs;
}

export function getHousingInfo(player: PlayerRow, now = Date.now()) {
  if (player.status === "traveling") {
    return { ok: false as const, error: "Вы в пути — жильё оформляется в городе после прибытия" };
  }

  const prices = getHousingPrices(player.city_id);
  const status = housingStatusForPlayer(player, now);
  const city = getCity(player.city_id);

  const ownedHere =
    player.housing_type === "owned" && player.housing_city_id === player.city_id;
  const buyQuote = null;
  const sellQuote = ownedHere ? quoteHousingSell(player, now) : null;

  return {
    ok: true as const,
    cityId: player.city_id,
    cityName: city?.name ?? player.city_id,
    prices,
    ...status,
    canBuy: !ownedHere,
    canSell: ownedHere,
    buyQuote: buyQuote && !("error" in buyQuote) ? buyQuote : null,
    sellAmountRub: sellQuote && !("error" in sellQuote) ? sellQuote.amountRub : null,
    sellCatalogPriceRub:
      sellQuote && !("error" in sellQuote) ? sellQuote.catalogPriceRub : null,
    properties: getHousingPropertiesForCity(player.city_id).map((prop) => {
      if (ownedHere && player.housing_property_id === prop.id) {
        return {
          ...prop,
          listPriceRub: prop.priceRub,
          netPriceRub: null,
          tradeInRub: 0,
          isOwned: true,
          canBuy: false,
          quoteError: null,
        };
      }
      const q = quoteHousingBuy(player, prop.id, now);
      if ("error" in q) {
        return {
          ...prop,
          listPriceRub: prop.priceRub,
          netPriceRub: null,
          tradeInRub: 0,
          isOwned: false,
          canBuy: false,
          quoteError: q.error,
        };
      }
      return {
        ...prop,
        listPriceRub: q.listPriceRub,
        netPriceRub: q.netPriceRub,
        tradeInRub: q.tradeInRub,
        isOwned: false,
        canBuy: true,
        quoteError: null,
        priceRub: q.netPriceRub,
      };
    }),
    ownedPropertyId: ownedHere ? player.housing_property_id : null,
    canRent: !ownedHere,
  };
}

export type HousingPayResult =
  | { ok: true; message: string }
  | { ok: false; error: string; code?: string };

function payDorm(player: PlayerRow, now: number): HousingPayResult {
  if (ownsApartmentInCity(player, player.city_id)) {
    return { ok: false, error: "У вас своя квартира — общежитие не нужно" };
  }
  const prices = getHousingPrices(player.city_id);
  if (player.rubles < prices.dormRub) {
    return { ok: false, error: `Не хватает денег (нужно ${prices.dormRub.toLocaleString("ru-RU")} ₽)` };
  }

  const addMs = config.dormHours * MS_HOUR;
  const sameCity = player.housing_city_id === player.city_id;
  const extend =
    sameCity && player.housing_type === "dorm" && player.housing_expires_at != null
      ? extendExpiry(player.housing_expires_at, addMs, now)
      : now + addMs;

  updatePlayer(player.user_id, {
    rubles: player.rubles - prices.dormRub,
    housing_type: "dorm",
    housing_city_id: player.city_id,
    housing_expires_at: extend,
  });

  return {
    ok: true,
    message: `Общежитие оплачено на ${config.dormHours} ч (−${prices.dormRub.toLocaleString("ru-RU")} ₽)`,
  };
}

function payRent(player: PlayerRow, now: number): HousingPayResult {
  if (ownsApartmentInCity(player, player.city_id)) {
    return { ok: false, error: "У вас своя квартира — аренда не нужна" };
  }
  const prices = getHousingPrices(player.city_id);
  if (player.rubles < prices.rentRub) {
    return { ok: false, error: `Не хватает денег (нужно ${prices.rentRub.toLocaleString("ru-RU")} ₽)` };
  }

  const addMs = config.rentDays * MS_DAY;
  const sameCity = player.housing_city_id === player.city_id;
  const extend =
    sameCity && player.housing_type === "rent" && player.housing_expires_at != null
      ? extendExpiry(player.housing_expires_at, addMs, now)
      : now + addMs;

  updatePlayer(player.user_id, {
    rubles: player.rubles - prices.rentRub,
    housing_type: "rent",
    housing_city_id: player.city_id,
    housing_expires_at: extend,
  });

  return {
    ok: true,
    message: `Аренда на ${config.rentDays} дн. (−${prices.rentRub.toLocaleString("ru-RU")} ₽)`,
  };
}

export type HousingBuyQuote = {
  listPriceRub: number;
  tradeInRub: number;
  netPriceRub: number;
  tradeInCatalogPriceRub: number | null;
  propertyId: string;
  propertyTitle: string;
};

function catalogPriceForOwned(player: PlayerRow): number | null {
  if (player.housing_type !== "owned" || !player.housing_city_id) return null;
  if (player.housing_property_id) {
    const p = getHousingProperty(player.housing_city_id, player.housing_property_id);
    if (p) return p.priceRub;
  }
  return getHousingPrices(player.housing_city_id).buyRub;
}

export function quoteHousingBuy(
  player: PlayerRow,
  propertyId: string,
  now = Date.now(),
): HousingBuyQuote | { error: string } {
  const prop = getHousingProperty(player.city_id, propertyId);
  if (!prop) return { error: "Вариант не найден" };
  if (ownsApartmentInCity(player, player.city_id)) {
    return { error: "У вас уже есть жильё в этом городе" };
  }
  let tradeInRub = 0;
  let tradeInCatalogPriceRub: number | null = null;
  if (player.housing_type === "owned" && player.housing_city_id && player.housing_city_id !== player.city_id) {
    tradeInCatalogPriceRub = catalogPriceForOwned(player);
    if (tradeInCatalogPriceRub != null) {
      tradeInRub = computeResaleValue(
        tradeInCatalogPriceRub,
        "housing",
        player.housing_owned_at,
        now,
        "trade_in",
      );
    }
  }
  return {
    listPriceRub: prop.priceRub,
    tradeInRub,
    netPriceRub: prop.priceRub - tradeInRub,
    tradeInCatalogPriceRub,
    propertyId: prop.id,
    propertyTitle: housingPropertyLabel(prop),
  };
}

export function quoteHousingSell(
  player: PlayerRow,
  now = Date.now(),
): { amountRub: number; catalogPriceRub: number } | { error: string } {
  if (player.housing_type !== "owned" || !player.housing_city_id) {
    return { error: "Нет квартиры для продажи" };
  }
  const catalogPriceRub = catalogPriceForOwned(player);
  if (catalogPriceRub == null) return { error: "Не удалось оценить жильё" };
  return {
    catalogPriceRub,
    amountRub: computeResaleValue(catalogPriceRub, "housing", player.housing_owned_at, now, "sell"),
  };
}

function payBuy(player: PlayerRow, propertyId: string, now = Date.now()): HousingPayResult {
  const prop = getHousingProperty(player.city_id, propertyId);
  if (!prop) return { ok: false, error: "Вариант не найден" };
  if (ownsApartmentInCity(player, player.city_id)) {
    return { ok: false, error: "У вас уже есть жильё в этом городе" };
  }
  const quote = quoteHousingBuy(player, propertyId, now);
  if ("error" in quote) return { ok: false, error: quote.error };
  if (player.rubles < quote.netPriceRub) {
    return {
      ok: false,
      error: `Не хватает денег (нужно ${quote.netPriceRub.toLocaleString("ru-RU")} ₽)`,
    };
  }

  updatePlayer(player.user_id, {
    rubles: player.rubles - quote.netPriceRub,
    housing_type: "owned",
    housing_city_id: player.city_id,
    housing_expires_at: null,
    housing_owned_at: now,
    housing_property_id: propertyId,
  });

  const tradeNote =
    quote.tradeInRub > 0 ? ` (зачёт ${quote.tradeInRub.toLocaleString("ru-RU")} ₽)` : "";
  return {
    ok: true,
    message: `${prop.title} куплена (−${quote.netPriceRub.toLocaleString("ru-RU")} ₽)${tradeNote}.`,
  };
}

export function sellOwnedHousing(player: PlayerRow, now = Date.now()): HousingPayResult {
  if (player.housing_type !== "owned" || !player.housing_city_id) {
    return { ok: false, error: "Нет квартиры для продажи" };
  }
  if (player.housing_city_id !== player.city_id) {
    return { ok: false, error: "Продать можно только жильё в текущем городе" };
  }
  const sellQuote = quoteHousingSell(player, now);
  if ("error" in sellQuote) return { ok: false, error: sellQuote.error };

  updatePlayer(player.user_id, {
    rubles: player.rubles + sellQuote.amountRub,
    housing_type: null,
    housing_city_id: null,
    housing_expires_at: null,
    housing_owned_at: null,
    housing_property_id: null,
  });

  return {
    ok: true,
    message: `Квартира продана (+${sellQuote.amountRub.toLocaleString("ru-RU")} ₽)`,
  };
}

export function payHousingDorm(player: PlayerRow, now = Date.now()): HousingPayResult {
  if (player.status === "traveling") return { ok: false, error: "Вы в пути" };
  return payDorm(player, now);
}

export function payHousingRent(player: PlayerRow, now = Date.now()): HousingPayResult {
  if (player.status === "traveling") return { ok: false, error: "Вы в пути" };
  return payRent(player, now);
}

export function payHousingBuy(
  player: PlayerRow,
  propertyId: string,
  now = Date.now(),
): HousingPayResult {
  if (player.status === "traveling") return { ok: false, error: "Вы в пути" };
  return payBuy(player, propertyId, now);
}

export const GUEST_WORK_ERROR =
  "Вы гость в этом городе. Оформите жильё в разделе «Недвижимость», чтобы работать.";

export function requireCityResident(player: PlayerRow, now = Date.now()): string | null {
  if (isCityResident(player, player.city_id, now)) return null;
  return GUEST_WORK_ERROR;
}
