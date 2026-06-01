import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { HousingType, PlayerRow } from "./db.js";
import { getPlayer, updatePlayer } from "./db.js";
import { DATA_DIR } from "./config.js";
import { getCity } from "./gameData.js";

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
    label = "Житель (своё жильё)";
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

  return {
    ok: true as const,
    cityId: player.city_id,
    cityName: city?.name ?? player.city_id,
    prices,
    ...status,
    canBuy: player.housing_type !== "owned" || player.housing_city_id !== player.city_id,
  };
}

export type HousingPayResult =
  | { ok: true; message: string }
  | { ok: false; error: string; code?: string };

function payDorm(player: PlayerRow, now: number): HousingPayResult {
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

function payBuy(player: PlayerRow): HousingPayResult {
  const prices = getHousingPrices(player.city_id);
  if (player.housing_type === "owned" && player.housing_city_id === player.city_id) {
    return { ok: false, error: "У вас уже есть жильё в этом городе" };
  }
  if (player.rubles < prices.buyRub) {
    return { ok: false, error: `Не хватает денег (нужно ${prices.buyRub.toLocaleString("ru-RU")} ₽)` };
  }

  updatePlayer(player.user_id, {
    rubles: player.rubles - prices.buyRub,
    housing_type: "owned",
    housing_city_id: player.city_id,
    housing_expires_at: null,
  });

  return {
    ok: true,
    message: `Квартира куплена (−${prices.buyRub.toLocaleString("ru-RU")} ₽). Вы житель города.`,
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

export function payHousingBuy(player: PlayerRow, now = Date.now()): HousingPayResult {
  if (player.status === "traveling") return { ok: false, error: "Вы в пути" };
  return payBuy(player);
}

export const GUEST_WORK_ERROR =
  "Вы гость в этом городе. Оформите жильё в разделе «Недвижимость», чтобы работать.";

export function requireCityResident(player: PlayerRow, now = Date.now()): string | null {
  if (isCityResident(player, player.city_id, now)) return null;
  return GUEST_WORK_ERROR;
}
