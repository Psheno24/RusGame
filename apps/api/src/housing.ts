import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { HousingType, PlayerRow } from "./db.js";
import { getPlayer, updatePlayer } from "./db.js";
import { computeResaleValue } from "./assetTrade.js";
import { DATA_DIR } from "./config.js";
import { getCity } from "./gameData.js";
import {
  getHousingPropertiesForCity,
  getHousingProperty,
  housingPropertyLabel,
} from "./housingCatalog.js";
import {
  clearSublet,
  deleteOwnedHousing,
  findOwnedHousing,
  getOwnedHousing,
  insertOwnedHousing,
  isSubletActive,
  listOwnedHousing,
  updateOwnedHousing,
  type OwnedHousingRow,
} from "./playerOwnedHousing.js";

type HousingConfig = {
  byTier: Record<string, { dormRub: number; rentRub: number; buyRub: number }>;
  dormHours: number;
  rentDays: number;
  starterDormDays: number;
};

const config = JSON.parse(readFileSync(join(DATA_DIR, "housing.json"), "utf-8")) as HousingConfig;

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;
const SUBLET_MONTH_MS = config.rentDays * MS_DAY;

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

function extendExpiry(current: number | null, addMs: number, now: number): number {
  const base = current != null && current > now ? current : now;
  return base + addMs;
}

function activeOwnedRecord(player: PlayerRow): OwnedHousingRow | undefined {
  if (player.housing_type !== "owned" || player.housing_owned_id == null) return undefined;
  return getOwnedHousing(player.housing_owned_id, player.user_id);
}

export function syncPlayerHousing(player: PlayerRow, now = Date.now()): PlayerRow {
  let p = player;
  let changed = false;

  if (
    (p.housing_type === "dorm" || p.housing_type === "rent") &&
    p.housing_expires_at != null &&
    p.housing_expires_at <= now
  ) {
    p = restoreLastResidence(p, now);
    changed = true;
  }

  const owned = listOwnedHousing(p.user_id);
  for (const row of owned) {
    if (row.sublet_until != null && row.sublet_until <= now) {
      clearSublet(row.id);
      changed = true;
    }
  }

  if (changed) {
    const fresh = getPlayer(p.user_id);
    return fresh ?? p;
  }
  return p;
}

function snapshotResidence(player: PlayerRow) {
  return {
    housing_last_type: player.housing_type,
    housing_last_city_id: player.housing_city_id,
    housing_last_expires_at: player.housing_expires_at,
    housing_last_owned_id: player.housing_owned_id,
    housing_last_property_id: player.housing_property_id,
  };
}

function applyOwnedResidence(player: PlayerRow, row: OwnedHousingRow): Partial<PlayerRow> {
  return {
    housing_type: "owned",
    housing_city_id: row.city_id,
    housing_property_id: row.property_id,
    housing_owned_id: row.id,
    housing_owned_at: row.acquired_at,
    housing_expires_at: null,
  };
}

function clearResidence(): Partial<PlayerRow> {
  return {
    housing_type: null,
    housing_city_id: null,
    housing_expires_at: null,
    housing_owned_at: null,
    housing_property_id: null,
    housing_owned_id: null,
  };
}

export function restoreLastResidence(player: PlayerRow, now = Date.now()): PlayerRow {
  const lastType = player.housing_last_type as HousingType | null;
  if (!lastType) {
    updatePlayer(player.user_id, clearResidence());
    return getPlayer(player.user_id) ?? player;
  }

  if (lastType === "owned" && player.housing_last_owned_id != null) {
    const row = getOwnedHousing(player.housing_last_owned_id, player.user_id);
    if (row) {
      clearSublet(row.id);
      updatePlayer(player.user_id, {
        ...applyOwnedResidence(player, row),
        housing_last_type: null,
        housing_last_city_id: null,
        housing_last_expires_at: null,
        housing_last_owned_id: null,
        housing_last_property_id: null,
      });
      const subletOthers = row.id;
      const fresh = getPlayer(player.user_id)!;
      subletOtherOwnedMonthly(fresh, subletOthers, now, false);
      return getPlayer(player.user_id) ?? fresh;
    }
  }

  if (lastType === "dorm" || lastType === "rent") {
    const expires = player.housing_last_expires_at;
    if (expires != null && expires > now && player.housing_last_city_id) {
      updatePlayer(player.user_id, {
        housing_type: lastType,
        housing_city_id: player.housing_last_city_id,
        housing_expires_at: expires,
        housing_owned_id: null,
        housing_property_id: null,
        housing_owned_at: null,
        housing_last_type: null,
        housing_last_city_id: null,
        housing_last_expires_at: null,
        housing_last_owned_id: null,
        housing_last_property_id: null,
      });
      return getPlayer(player.user_id) ?? player;
    }
  }

  updatePlayer(player.user_id, {
    ...clearResidence(),
    housing_last_type: null,
    housing_last_city_id: null,
    housing_last_expires_at: null,
    housing_last_owned_id: null,
    housing_last_property_id: null,
  });
  return getPlayer(player.user_id) ?? player;
}

/** Доход за сдачу: месячная аренда города / 30 × число дней периода. */
export function subletIncomeForPeriod(cityId: string, periodMs: number): number {
  if (periodMs <= 0) return 0;
  const { rentRub, rentDays } = getHousingPrices(cityId);
  const perDay = rentRub / rentDays;
  return Math.max(0, Math.round(perDay * (periodMs / MS_DAY)));
}

/** Возврат жильцам при досрочном выезде (неиспользованная часть сдачи). */
export function subletRepayAmount(row: OwnedHousingRow, now = Date.now()): number {
  if (!isSubletActive(row, now) || row.sublet_income_rub <= 0) return 0;
  if (row.sublet_from == null || row.sublet_until == null) return row.sublet_income_rub;
  const totalMs = row.sublet_until - row.sublet_from;
  if (totalMs <= 0) return row.sublet_income_rub;
  const remainingMs = Math.max(0, row.sublet_until - now);
  return Math.round(row.sublet_income_rub * (remainingMs / totalMs));
}

/** Сдать на период; уже сдающиеся квартиры не трогаем. */
function startSubletPeriod(
  row: OwnedHousingRow,
  periodStart: number,
  periodEnd: number,
  now: number,
): { incomeRub: number; skipped: boolean } {
  if (isSubletActive(row, now)) {
    return { incomeRub: 0, skipped: true };
  }
  const periodMs = periodEnd - periodStart;
  const income = subletIncomeForPeriod(row.city_id, periodMs);
  updateOwnedHousing(row.id, {
    sublet_from: periodStart,
    sublet_until: periodEnd,
    sublet_income_rub: income,
  });
  return { incomeRub: income, skipped: false };
}

/** Сдать все квартиры, которые ещё не в сдаче, на тот же срок. */
function subletVacantOwnedForPeriod(
  player: PlayerRow,
  periodStart: number,
  periodEnd: number,
  now: number,
  creditPlayer: boolean,
  exceptId: number | null = null,
): number {
  let totalIncome = 0;
  for (const row of listOwnedHousing(player.user_id)) {
    if (exceptId != null && row.id === exceptId) continue;
    const { incomeRub, skipped } = startSubletPeriod(row, periodStart, periodEnd, now);
    if (!skipped) totalIncome += incomeRub;
  }
  if (creditPlayer && totalIncome > 0) {
    updatePlayer(player.user_id, { rubles: player.rubles + totalIncome });
  }
  return totalIncome;
}

/** Сдача остальных квартир на 30 дней при переезде в свою (правило «жить здесь»). */
function subletOtherOwnedMonthly(
  player: PlayerRow,
  exceptId: number,
  now: number,
  creditPlayer: boolean,
): number {
  const periodEnd = now + SUBLET_MONTH_MS;
  return subletVacantOwnedForPeriod(player, now, periodEnd, now, creditPlayer, exceptId);
}

export function isCityResident(player: PlayerRow, cityId?: string, now = Date.now()): boolean {
  const p = syncPlayerHousing(player, now);
  const cid = cityId ?? p.city_id;
  if (!p.housing_type || !p.housing_city_id) return false;
  if (p.housing_city_id !== cid) return false;
  if (p.housing_type === "owned") {
    const row = activeOwnedRecord(p);
    if (row) return row.city_id === cid && !isSubletActive(row, now);
    return p.housing_city_id === cid;
  }
  if (p.housing_type === "dorm" || p.housing_type === "rent") {
    return p.housing_expires_at != null && p.housing_expires_at > now;
  }
  return false;
}

export function housingStatusForPlayer(player: PlayerRow, now = Date.now()) {
  const p = syncPlayerHousing(player, now);
  const inCity = p.city_id;
  const resident = isCityResident(p, inCity, now);
  const activeInCurrent =
    p.housing_city_id === inCity &&
    (p.housing_type === "owned"
      ? (() => {
          const row = activeOwnedRecord(p);
          return row != null && !isSubletActive(row, now);
        })()
      : p.housing_expires_at != null && p.housing_expires_at > now);

  let label = "Гость";
  let expiresAt: number | null = null;
  if (activeInCurrent && p.housing_type === "owned") {
    const row = activeOwnedRecord(p);
    const prop =
      row && row.property_id ? getHousingProperty(row.city_id, row.property_id) : undefined;
    label = prop ? `Житель · ${housingPropertyLabel(prop)}` : "Житель (своё жильё)";
  } else if (activeInCurrent && p.housing_expires_at) {
    label = p.housing_type === "rent" ? "Житель · аренда" : "Житель · общежитие";
    expiresAt = p.housing_expires_at;
  } else if (p.housing_city_id && p.housing_city_id !== inCity) {
    const other = getCity(p.housing_city_id);
    label = `Жильё в ${other?.name ?? p.housing_city_id} — здесь вы гость`;
  } else {
    const subletCount = listOwnedHousing(p.user_id).filter((r) => isSubletActive(r, now)).length;
    if (subletCount > 0) {
      label = `Гость · сдаёте ${subletCount} кв.`;
    }
  }

  return {
    isResident: resident,
    housingType: p.housing_type as HousingType | null,
    housingCityId: p.housing_city_id,
    housingExpiresAt: p.housing_expires_at,
    statusLabel: label,
    expiresAt,
  };
}

export function getHousingInfo(player: PlayerRow, now = Date.now()) {
  const p = syncPlayerHousing(player, now);
  if (p.status === "traveling") {
    return { ok: false as const, error: "Вы в пути — жильё оформляется в городе после прибытия" };
  }

  const prices = getHousingPrices(p.city_id);
  const status = housingStatusForPlayer(p, now);
  const city = getCity(p.city_id);
  const ownedHere = listOwnedHousing(p.user_id).filter((r) => r.city_id === p.city_id);
  const livingHere =
    p.housing_type === "owned" &&
    activeOwnedRecord(p)?.city_id === p.city_id &&
    !isSubletActive(activeOwnedRecord(p)!, now);

  return {
    ok: true as const,
    cityId: p.city_id,
    cityName: city?.name ?? p.city_id,
    prices,
    ...status,
    canBuy: true,
    canSell: ownedHere.length > 0,
    canRent: !status.isResident,
    properties: getHousingPropertiesForCity(p.city_id).map((prop) => {
      const owned = findOwnedHousing(p.user_id, p.city_id, prop.id);
      if (owned) {
        const sellQ = quoteHousingSellById(p, owned.id, now);
        return {
          ...prop,
          listPriceRub: prop.priceRub,
          netPriceRub: null,
          tradeInRub: 0,
          isOwned: true,
          ownedRecordId: owned.id,
          isSublet: isSubletActive(owned, now),
          subletUntil: owned.sublet_until,
          canBuy: false,
          quoteError: null,
          sellAmountRub: sellQ && !("error" in sellQ) ? sellQ.amountRub : null,
          sellCatalogPriceRub: sellQ && !("error" in sellQ) ? sellQ.catalogPriceRub : null,
          isActiveResidence: p.housing_owned_id === owned.id,
        };
      }
      const q = quoteHousingBuy(p, prop.id, now);
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
    ownedPropertyId: livingHere ? p.housing_property_id : null,
    ownedCount: listOwnedHousing(p.user_id).length,
    subletPreviewIncomeRub: previewSubletIncomeForDorm(p, now),
    subletPreviewRentIncomeRub: previewSubletIncomeForRent(p, now),
    sellAmountRub: null,
    sellCatalogPriceRub: null,
  };
}

export type HousingPayResult =
  | { ok: true; message: string }
  | { ok: false; error: string; code?: string };

export type HousingBuyQuote = {
  listPriceRub: number;
  tradeInRub: number;
  netPriceRub: number;
  tradeInCatalogPriceRub: number | null;
  propertyId: string;
  propertyTitle: string;
};

export type LiveHereQuote = {
  ownedId: number;
  title: string;
  cityName: string;
  repayRub: number;
  subletOthersIncomeRub: number;
  subletOthersCount: number;
};

export function quoteLiveHere(
  player: PlayerRow,
  ownedId: number,
  now = Date.now(),
): LiveHereQuote | { error: string } {
  const p = syncPlayerHousing(player, now);
  const row = getOwnedHousing(ownedId, p.user_id);
  if (!row) return { error: "Квартира не найдена" };
  const prop = getHousingProperty(row.city_id, row.property_id);
  if (!prop) return { error: "Квартира не найдена" };
  if (p.housing_owned_id === row.id && p.housing_type === "owned") {
    return { error: "Вы уже живёте в этой квартире" };
  }

  const repayRub = isSubletActive(row, now) ? subletRepayAmount(row, now) : 0;

  let subletOthersCount = 0;
  let subletOthersIncomeRub = 0;
  for (const other of listOwnedHousing(p.user_id)) {
    if (other.id === row.id) continue;
    if (!isSubletActive(other, now)) {
      subletOthersCount++;
      subletOthersIncomeRub += subletIncomeForPeriod(other.city_id, SUBLET_MONTH_MS);
    }
  }

  const city = getCity(row.city_id);
  return {
    ownedId: row.id,
    title: prop.title,
    cityName: city?.name ?? row.city_id,
    repayRub,
    subletOthersIncomeRub,
    subletOthersCount,
  };
}

export function payLiveHere(player: PlayerRow, ownedId: number, now = Date.now()): HousingPayResult {
  const quote = quoteLiveHere(player, ownedId, now);
  if ("error" in quote) return { ok: false, error: quote.error };

  let p = syncPlayerHousing(player, now);
  const row = getOwnedHousing(ownedId, p.user_id)!;
  const totalCost = quote.repayRub;
  if (p.rubles < totalCost) {
    return {
      ok: false,
      error: `Не хватает денег (нужно ${totalCost.toLocaleString("ru-RU")} ₽)`,
    };
  }

  const wasRent = p.housing_type === "dorm" || p.housing_type === "rent";
  const patch: Partial<PlayerRow> = {
    ...applyOwnedResidence(p, row),
    rubles: p.rubles - totalCost,
  };
  if (wasRent || (p.housing_type === "owned" && p.housing_owned_id !== row.id)) {
    Object.assign(patch, snapshotResidence(p));
  }

  clearSublet(row.id);
  updatePlayer(p.user_id, patch);
  p = getPlayer(p.user_id)!;

  const income = subletOtherOwnedMonthly(p, row.id, now, true);

  const parts: string[] = [`Теперь вы живёте: ${quote.title} (${quote.cityName})`];
  if (quote.repayRub > 0) {
    parts.push(`возврат жильцам −${quote.repayRub.toLocaleString("ru-RU")} ₽`);
  }
  if (income > 0) {
    parts.push(`остальные квартиры сданы (+${income.toLocaleString("ru-RU")} ₽)`);
  }
  return { ok: true, message: parts.join(". ") + "." };
}

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

  const snapshot =
    player.housing_type === "owned" && player.housing_owned_id != null
      ? snapshotResidence(player)
      : {};

  updatePlayer(player.user_id, {
    rubles: player.rubles - prices.dormRub,
    housing_type: "dorm",
    housing_city_id: player.city_id,
    housing_expires_at: extend,
    housing_owned_id: null,
    housing_property_id: null,
    housing_owned_at: null,
    ...snapshot,
  });

  const fresh = getPlayer(player.user_id)!;
  const periodStart =
    sameCity && player.housing_type === "dorm" && player.housing_expires_at != null && player.housing_expires_at > now
      ? player.housing_expires_at
      : now;
  const income = subletVacantOwnedForPeriod(fresh, periodStart, extend, now, true);
  const days = Math.round((extend - periodStart) / MS_DAY);
  const msg =
    income > 0
      ? `Общежитие на ${config.dormHours} ч (−${prices.dormRub.toLocaleString("ru-RU")} ₽). Свободные квартиры сданы на ${days} дн. (+${income.toLocaleString("ru-RU")} ₽).`
      : `Общежитие оплачено на ${config.dormHours} ч (−${prices.dormRub.toLocaleString("ru-RU")} ₽)`;
  return { ok: true, message: msg };
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

  const snapshot =
    player.housing_type === "owned" && player.housing_owned_id != null
      ? snapshotResidence(player)
      : {};

  updatePlayer(player.user_id, {
    rubles: player.rubles - prices.rentRub,
    housing_type: "rent",
    housing_city_id: player.city_id,
    housing_expires_at: extend,
    housing_owned_id: null,
    housing_property_id: null,
    housing_owned_at: null,
    ...snapshot,
  });

  const fresh = getPlayer(player.user_id)!;
  const periodStart =
    sameCity && player.housing_type === "rent" && player.housing_expires_at != null && player.housing_expires_at > now
      ? player.housing_expires_at
      : now;
  const income = subletVacantOwnedForPeriod(fresh, periodStart, extend, now, true);
  const msg =
    income > 0
      ? `Аренда на ${config.rentDays} дн. (−${prices.rentRub.toLocaleString("ru-RU")} ₽). Свободные квартиры сданы (+${income.toLocaleString("ru-RU")} ₽).`
      : `Аренда на ${config.rentDays} дн. (−${prices.rentRub.toLocaleString("ru-RU")} ₽)`;
  return { ok: true, message: msg };
}

function previewSubletIncomeForPeriod(player: PlayerRow, periodMs: number, now: number): number {
  let sum = 0;
  for (const row of listOwnedHousing(player.user_id)) {
    if (isSubletActive(row, now)) continue;
    sum += subletIncomeForPeriod(row.city_id, periodMs);
  }
  return sum;
}

function previewSubletIncomeForDorm(player: PlayerRow, now: number): number {
  return previewSubletIncomeForPeriod(player, config.dormHours * MS_HOUR, now);
}

function previewSubletIncomeForRent(player: PlayerRow, now: number): number {
  return previewSubletIncomeForPeriod(player, config.rentDays * MS_DAY, now);
}

export function quoteHousingBuy(
  player: PlayerRow,
  propertyId: string,
  now = Date.now(),
): HousingBuyQuote | { error: string } {
  const p = syncPlayerHousing(player, now);
  const prop = getHousingProperty(p.city_id, propertyId);
  if (!prop) return { error: "Вариант не найден" };
  if (findOwnedHousing(p.user_id, p.city_id, propertyId)) {
    return { error: "Эта квартира у вас уже есть" };
  }
  return {
    listPriceRub: prop.priceRub,
    tradeInRub: 0,
    netPriceRub: prop.priceRub,
    tradeInCatalogPriceRub: null,
    propertyId: prop.id,
    propertyTitle: housingPropertyLabel(prop),
  };
}

export function quoteHousingSellById(
  player: PlayerRow,
  ownedId: number,
  now = Date.now(),
): { amountRub: number; catalogPriceRub: number } | { error: string } {
  const row = getOwnedHousing(ownedId, player.user_id);
  if (!row) return { error: "Квартира не найдена" };
  const prop = getHousingProperty(row.city_id, row.property_id);
  const catalogPriceRub = prop?.priceRub ?? getHousingPrices(row.city_id).buyRub;
  return {
    catalogPriceRub,
    amountRub: computeResaleValue(catalogPriceRub, "housing", row.acquired_at, now, "sell"),
  };
}

export function quoteHousingSell(player: PlayerRow, now = Date.now()) {
  if (player.housing_owned_id != null) {
    return quoteHousingSellById(player, player.housing_owned_id, now);
  }
  const inCity = listOwnedHousing(player.user_id).filter((r) => r.city_id === player.city_id);
  if (inCity.length === 1) return quoteHousingSellById(player, inCity[0]!.id, now);
  return { error: "Укажите квартиру для продажи" };
}

export type HousingBuyQuotePreview = HousingBuyQuote & {
  willMoveIn: boolean;
  subletNewIncomeRub: number;
};

export function quoteHousingBuyDetailed(
  player: PlayerRow,
  propertyId: string,
  now = Date.now(),
): HousingBuyQuotePreview | { error: string } {
  const base = quoteHousingBuy(player, propertyId, now);
  if ("error" in base) return base;
  const p = syncPlayerHousing(player, now);
  let subletNewIncomeRub = 0;
  for (const row of listOwnedHousing(p.user_id)) {
    if (!isSubletActive(row, now)) {
      subletNewIncomeRub += subletIncomeForPeriod(row.city_id, SUBLET_MONTH_MS);
    }
  }
  return { ...base, willMoveIn: true, subletNewIncomeRub };
}

function payBuy(player: PlayerRow, propertyId: string, now = Date.now()): HousingPayResult {
  const p = syncPlayerHousing(player, now);
  const prop = getHousingProperty(p.city_id, propertyId);
  if (!prop) return { ok: false, error: "Вариант не найден" };
  const quote = quoteHousingBuy(p, propertyId, now);
  if ("error" in quote) return { ok: false, error: quote.error };
  if (p.rubles < quote.netPriceRub) {
    return {
      ok: false,
      error: `Не хватает денег (нужно ${quote.netPriceRub.toLocaleString("ru-RU")} ₽)`,
    };
  }

  const ownedId = insertOwnedHousing(p.user_id, p.city_id, propertyId, now);
  const row = getOwnedHousing(ownedId, p.user_id)!;

  const needsSnapshot =
    p.housing_type === "dorm" ||
    p.housing_type === "rent" ||
    (p.housing_type === "owned" && p.housing_owned_id != null);
  const patch: Partial<PlayerRow> = {
    rubles: p.rubles - quote.netPriceRub,
    ...applyOwnedResidence(p, row),
    ...(needsSnapshot ? snapshotResidence(p) : {}),
  };

  updatePlayer(p.user_id, patch);
  let fresh = getPlayer(p.user_id)!;

  const income = subletOtherOwnedMonthly(fresh, ownedId, now, true);

  const msg =
    income > 0
      ? `${prop.title} куплена (−${quote.netPriceRub.toLocaleString("ru-RU")} ₽). Вы здесь. Остальные сданы (+${income.toLocaleString("ru-RU")} ₽).`
      : `${prop.title} куплена (−${quote.netPriceRub.toLocaleString("ru-RU")} ₽). Вы здесь.`;
  return { ok: true, message: msg };
}

export function sellOwnedHousing(
  player: PlayerRow,
  ownedId?: number,
  now = Date.now(),
): HousingPayResult {
  const p = syncPlayerHousing(player, now);
  let id = ownedId;
  if (id == null) {
    const inCity = listOwnedHousing(p.user_id).filter((r) => r.city_id === p.city_id);
    if (inCity.length !== 1) return { ok: false, error: "Укажите квартиру" };
    id = inCity[0]!.id;
  }

  const row = getOwnedHousing(id, p.user_id);
  if (!row) return { ok: false, error: "Квартира не найдена" };
  if (row.city_id !== p.city_id) {
    return { ok: false, error: "Продать можно только находясь в городе квартиры" };
  }

  const sellQuote = quoteHousingSellById(p, row.id, now);
  if ("error" in sellQuote) return { ok: false, error: sellQuote.error };

  const wasHome = p.housing_owned_id === row.id && p.housing_type === "owned";
  deleteOwnedHousing(row.id, p.user_id);

  const rublesAfterSale = p.rubles + sellQuote.amountRub;
  if (wasHome) {
    updatePlayer(p.user_id, {
      rubles: rublesAfterSale,
      ...clearResidence(),
    });
    const afterSale = getPlayer(p.user_id)!;
    restoreLastResidence(afterSale, now);
  } else {
    updatePlayer(p.user_id, { rubles: rublesAfterSale });
  }

  const prop = getHousingProperty(row.city_id, row.property_id);
  return {
    ok: true,
    message: `${prop?.title ?? "Квартира"} продана (+${sellQuote.amountRub.toLocaleString("ru-RU")} ₽)${
      wasHome ? ". Восстановлено прежнее жильё." : ""
    }`,
  };
}

export function payHousingDorm(player: PlayerRow, now = Date.now()): HousingPayResult {
  if (player.status === "traveling") return { ok: false, error: "Вы в пути" };
  return payDorm(syncPlayerHousing(player, now), now);
}

export function payHousingRent(player: PlayerRow, now = Date.now()): HousingPayResult {
  if (player.status === "traveling") return { ok: false, error: "Вы в пути" };
  return payRent(syncPlayerHousing(player, now), now);
}

export function payHousingBuy(
  player: PlayerRow,
  propertyId: string,
  now = Date.now(),
): HousingPayResult {
  if (player.status === "traveling") return { ok: false, error: "Вы в пути" };
  return payBuy(syncPlayerHousing(player, now), propertyId, now);
}

export const GUEST_WORK_ERROR =
  "Вы гость в этом городе. Оформите жильё в разделе «Недвижимость», чтобы работать.";

export function requireCityResident(player: PlayerRow, now = Date.now()): string | null {
  if (isCityResident(player, player.city_id, now)) return null;
  return GUEST_WORK_ERROR;
}
