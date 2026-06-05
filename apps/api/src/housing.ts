import { formatRub } from "./formatRub.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { HousingType, PlayerRow } from "./db.js";
import { getPlayer, updatePlayer } from "./db.js";
import { computeResaleValue, housingTradeInRateHint } from "./assetTrade.js";
import { appendPlayerFeed } from "./playerFeed.js";
import { DATA_DIR } from "./config.js";
import { getCity } from "./gameData.js";
import {
  getCityHousingMultiplier,
  getHousingPropertiesForCity,
  getHousingProperty,
  housingPropertyLabel,
} from "./housingCatalog.js";
import {
  migrateLegacyHousingLast,
  parseHousingStack,
  pushCurrentResidenceToStack,
  purgeExpiredStackEntries,
  restoreFromHousingStack,
} from "./housingStack.js";
import {
  clearSublet,
  deleteOwnedHousing,
  findOwnedHousing,
  getOwnedHousing,
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
const MS_WEEK = 7 * MS_DAY;
const MAX_DORM_AHEAD_MS = 7 * MS_DAY;
const RENT_EXTEND_WINDOW_MS = 7 * MS_DAY;
const SUBLET_MONTH_MS = config.rentDays * MS_DAY;

function weeklyNetForProperty(cityId: string, propertyId: string): number {
  const prop = getHousingProperty(cityId, propertyId);
  if (!prop) return 0;
  return prop.weeklyNetIncomeRub ?? Math.round(prop.monthlyNetIncomeRub / 4);
}

function subletPeriodPatch(periodStart: number, periodEnd: number, incomeRub: number) {
  return {
    sublet_from: periodStart,
    sublet_until: periodEnd,
    sublet_income_rub: incomeRub,
    sublet_paid_rub: 0,
    sublet_next_payout_at: periodStart,
    sublet_retry_at: null as null,
    sublet_retry_chance: null as null,
  };
}

/** Еженедельные выплаты по активной сдаче (догоняет пропущенные недели). */
function creditWeeklySubletPayouts(row: OwnedHousingRow, userId: number, now: number): boolean {
  if (!isSubletActive(row, now) || row.sublet_from == null || row.sublet_until == null) {
    return false;
  }
  const weekly = weeklyNetForProperty(row.city_id, row.property_id);
  if (weekly <= 0) return false;

  let nextAt = row.sublet_next_payout_at ?? row.sublet_from;
  let paidRub = row.sublet_paid_rub;
  let totalCredited = 0;

  while (now >= nextAt && nextAt < row.sublet_until) {
    const remaining = row.sublet_income_rub - paidRub;
    if (remaining <= 0) break;
    const amount = Math.min(weekly, remaining);
    totalCredited += amount;
    paidRub += amount;
    nextAt += MS_WEEK;
  }

  if (totalCredited <= 0) return false;

  updateOwnedHousing(row.id, {
    sublet_paid_rub: paidRub,
    sublet_next_payout_at: nextAt,
  });
  const pl = getPlayer(userId);
  if (pl) updatePlayer(userId, { rubles: pl.rubles + totalCredited });
  return true;
}

export function getHousingPrices(cityId: string) {
  const city = getCity(cityId);
  const tier = String(city?.tier ?? 2);
  const prices = config.byTier[tier] ?? config.byTier["2"]!;
  const mult = getCityHousingMultiplier(cityId);
  const cheapest = getHousingPropertiesForCity(cityId)[0];
  return {
    tier: city?.tier ?? 2,
    dormRub: Math.round(prices.dormRub * mult),
    rentRub: Math.round(prices.rentRub * mult),
    buyRub: cheapest?.priceRub ?? Math.round(prices.buyRub * mult),
    dormHours: config.dormHours,
    rentDays: config.rentDays,
    cityMultiplier: mult,
  };
}

/** Цена суток в общежитии (dormHours = 24). */
export function dormDayPriceRub(cityId: string): number {
  return getHousingPrices(cityId).dormRub;
}

function extendExpiry(current: number | null, addMs: number, now: number): number {
  const base = current != null && current > now ? current : now;
  return base + addMs;
}

function activeOwnedRecord(player: PlayerRow): OwnedHousingRow | undefined {
  if (player.housing_type !== "owned" || player.housing_owned_id == null) return undefined;
  return getOwnedHousing(player.housing_owned_id, player.user_id);
}

function processOwnedSubletTick(row: OwnedHousingRow, userId: number, now: number): boolean {
  if (!isSubletActive(row, now) && row.sublet_retry_at != null && now >= row.sublet_retry_at) {
    const chance = row.sublet_retry_chance ?? 0.2;
    if (Math.random() < chance) {
      const periodEnd = now + SUBLET_MONTH_MS;
      const income = subletIncomeForOwned(row, SUBLET_MONTH_MS);
      updateOwnedHousing(row.id, subletPeriodPatch(now, periodEnd, income));
    } else {
      updateOwnedHousing(row.id, {
        sublet_retry_at: row.sublet_retry_at + MS_DAY,
        sublet_retry_chance: Math.min(1, chance + 0.05),
      });
    }
    return true;
  }

  if (row.sublet_until != null && row.sublet_until <= now) {
    if (Math.random() < 0.8) {
      const periodEnd = now + SUBLET_MONTH_MS;
      const income = subletIncomeForOwned(row, SUBLET_MONTH_MS);
      updateOwnedHousing(row.id, subletPeriodPatch(now, periodEnd, income));
    } else {
      updateOwnedHousing(row.id, {
        sublet_from: null,
        sublet_until: null,
        sublet_income_rub: 0,
        sublet_retry_at: now + MS_DAY,
        sublet_retry_chance: 0.2,
      });
    }
    return true;
  }
  return false;
}

function extendActiveSublets(player: PlayerRow, addMs: number, now: number): number {
  let totalIncome = 0;
  for (const row of listOwnedHousing(player.user_id)) {
    if (!isSubletActive(row, now)) continue;
    const newUntil = row.sublet_until! + addMs;
    const extra = subletIncomeForOwned(row, addMs);
    updateOwnedHousing(row.id, {
      sublet_until: newUntil,
      sublet_income_rub: row.sublet_income_rub + extra,
    });
    totalIncome += extra;
  }
  return totalIncome;
}

export function syncPlayerHousing(player: PlayerRow, now = Date.now()): PlayerRow {
  let p = migrateLegacyHousingLast(player);
  p = purgeExpiredStackEntries(p, now);
  let residenceChanged = p !== player;
  let rublesChanged = false;

  if (
    (p.housing_type === "dorm" || p.housing_type === "rent") &&
    p.housing_expires_at != null &&
    p.housing_expires_at <= now
  ) {
    p = restoreLastResidence(p, now);
    residenceChanged = true;
  }

  for (const row of listOwnedHousing(p.user_id)) {
    let guard = 0;
    while (guard++ < 64) {
      const cur = getOwnedHousing(row.id, p.user_id);
      if (!cur) break;
      if (isSubletActive(cur, now) && creditWeeklySubletPayouts(cur, p.user_id, now)) {
        rublesChanged = true;
      }
      const fresh = getOwnedHousing(row.id, p.user_id);
      if (!fresh) break;
      if (!processOwnedSubletTick(fresh, p.user_id, now)) break;
      rublesChanged = true;
    }
  }

  const beforePending = p;
  const afterPending = resolvePendingHousingBuyChoice(p, now);
  if (afterPending !== beforePending) residenceChanged = true;
  p = afterPending;

  if (residenceChanged) {
    return getPlayer(p.user_id) ?? p;
  }
  if (rublesChanged) {
    const fresh = getPlayer(p.user_id);
    if (fresh) return { ...p, rubles: fresh.rubles };
  }
  return p;
}

/** Если после покупки не выбрали «жить / сдавать» — сдаём автоматически. */
function resolvePendingHousingBuyChoice(player: PlayerRow, now: number): PlayerRow {
  const pendingId = player.housing_pending_owned_id;
  if (pendingId == null) return player;

  const row = getOwnedHousing(pendingId, player.user_id);
  if (!row) {
    updatePlayer(player.user_id, { housing_pending_owned_id: null });
    return getPlayer(player.user_id) ?? player;
  }

  if (
    (player.housing_type === "owned" && player.housing_owned_id === row.id) ||
    isSubletActive(row, now)
  ) {
    updatePlayer(player.user_id, { housing_pending_owned_id: null });
    return getPlayer(player.user_id) ?? player;
  }

  const periodEnd = now + SUBLET_MONTH_MS;
  const income = subletIncomeForOwned(row, SUBLET_MONTH_MS);
  updateOwnedHousing(row.id, subletPeriodPatch(now, periodEnd, income));
  updatePlayer(player.user_id, { housing_pending_owned_id: null });
  creditWeeklySubletPayouts(getOwnedHousing(row.id, player.user_id)!, player.user_id, now);
  return getPlayer(player.user_id) ?? player;
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
  const restored = restoreFromHousingStack(player, now);
  if (!restored) {
    updatePlayer(player.user_id, { ...clearResidence(), housing_stack: null });
    return getPlayer(player.user_id) ?? player;
  }
  updatePlayer(player.user_id, { ...restored.patch, housing_stack: null });
  const fresh = getPlayer(player.user_id)!;
  if (fresh.housing_owned_id != null) {
    subletOtherOwnedMonthly(fresh, fresh.housing_owned_id, now, false);
  }
  return getPlayer(player.user_id) ?? fresh;
}

/** Суммарный чистый доход за период сдачи (≈ недельные выплаты × недели). */
export function subletIncomeForProperty(
  cityId: string,
  propertyId: string,
  periodMs: number,
): number {
  if (periodMs <= 0) return 0;
  const weekly = weeklyNetForProperty(cityId, propertyId);
  if (weekly <= 0) return 0;
  return Math.max(0, Math.round((weekly * periodMs) / MS_WEEK));
}

/** @deprecated Используйте subletIncomeForProperty — оставлено для обратной совместимости тестов. */
export function subletIncomeForPeriod(cityId: string, periodMs: number): number {
  const props = getHousingPropertiesForCity(cityId);
  const studio = props.find((p) => p.typeKey === "studio") ?? props[0];
  if (!studio) return 0;
  return subletIncomeForProperty(cityId, studio.id, periodMs);
}

export function subletIncomeForOwned(row: OwnedHousingRow, periodMs: number): number {
  return subletIncomeForProperty(row.city_id, row.property_id, periodMs);
}

/** Возврат жильцам при досрочном выезде (неиспользованная часть сдачи). */
/** Возврат жильцам: неполученная часть договора сдачи (ещё не выплаченная игроку). */
export function subletRepayAmount(row: OwnedHousingRow, now = Date.now()): number {
  if (!isSubletActive(row, now) || row.sublet_income_rub <= 0) return 0;
  return Math.max(0, row.sublet_income_rub - row.sublet_paid_rub);
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
  const income = subletIncomeForOwned(row, periodMs);
  updateOwnedHousing(row.id, subletPeriodPatch(periodStart, periodEnd, income));
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
    if (!skipped) {
      totalIncome += incomeRub;
      if (creditPlayer) {
        const fresh = getOwnedHousing(row.id, player.user_id);
        if (fresh) creditWeeklySubletPayouts(fresh, player.user_id, now);
      }
    }
  }
  return totalIncome;
}

/** Сдача остальных квартир на 30 дней при переезде в свою (первая сдача — 100%). */
export function subletOtherOwnedMonthly(
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

/** Есть ли у игрока активное жильё (аренда или своё, где он живёт) в любом городе. */
export function playerHasAnyHousing(player: PlayerRow, now = Date.now()): boolean {
  const p = syncPlayerHousing(player, now);
  if (!p.housing_type || !p.housing_city_id) return false;
  if (p.housing_type === "dorm" || p.housing_type === "rent") {
    return p.housing_expires_at != null && p.housing_expires_at > now;
  }
  if (p.housing_type === "owned") {
    const row = activeOwnedRecord(p);
    return row != null && !isSubletActive(row, now);
  }
  return false;
}

export type HousingExtendInfo = {
  canExtendDorm: boolean;
  canExtendRent: boolean;
  dormExtendRub: number;
  rentExtendRub: number;
  dormExtendLabel: string;
  rentExtendLabel: string;
  dormDisabledReason: string | null;
  rentDisabledReason: string | null;
};

export function getHousingExtendInfo(player: PlayerRow, now = Date.now()): HousingExtendInfo {
  const p = syncPlayerHousing(player, now);
  const prices = getHousingPrices(p.city_id);
  const addDormMs = config.dormHours * MS_HOUR;
  const addRentMs = config.rentDays * MS_DAY;

  let canExtendDorm = false;
  let canExtendRent = false;
  let dormDisabledReason: string | null = null;
  let rentDisabledReason: string | null = null;

  const dormActive =
    p.housing_type === "dorm" &&
    p.housing_city_id === p.city_id &&
    p.housing_expires_at != null &&
    p.housing_expires_at > now;

  if (dormActive) {
    const newExpiry = extendExpiry(p.housing_expires_at, addDormMs, now);
    if (newExpiry - now > MAX_DORM_AHEAD_MS) {
      dormDisabledReason = "Не более 7 суток вперёд";
    } else if (p.rubles < prices.dormRub) {
      dormDisabledReason = `Нужно ${formatRub(prices.dormRub)}`;
    } else {
      canExtendDorm = true;
    }
  }

  const rentActive =
    p.housing_type === "rent" &&
    p.housing_city_id === p.city_id &&
    p.housing_expires_at != null &&
    p.housing_expires_at > now;

  if (rentActive) {
    const remaining = p.housing_expires_at! - now;
    if (remaining >= RENT_EXTEND_WINDOW_MS) {
      rentDisabledReason = "Продление доступно, когда осталось меньше 7 дней";
    } else if (p.rubles < prices.rentRub) {
      rentDisabledReason = `Нужно ${formatRub(prices.rentRub)}`;
    } else {
      canExtendRent = true;
    }
  }

  return {
    canExtendDorm,
    canExtendRent,
    dormExtendRub: prices.dormRub,
    rentExtendRub: prices.rentRub,
    dormExtendLabel: `+${config.dormHours} ч`,
    rentExtendLabel: `+${config.rentDays} дн.`,
    dormDisabledReason,
    rentDisabledReason,
  };
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
      const economy = {
        monthlyRentRub: prop.monthlyRentRub,
        monthlyExpensesRub: prop.monthlyExpensesRub,
        monthlyNetIncomeRub: prop.monthlyNetIncomeRub,
        weeklyRentRub: prop.weeklyRentRub,
        weeklyExpensesRub: prop.weeklyExpensesRub,
        weeklyNetIncomeRub: prop.weeklyNetIncomeRub,
        expenseRatePct: prop.expenseRatePct,
        prestige: prop.prestige,
        moodBonus: prop.moodBonus,
        description: prop.description,
      };
      if (owned) {
        const sellQ = quoteHousingSellById(p, owned.id, now);
        return {
          ...prop,
          ...economy,
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
          ...economy,
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
        ...economy,
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
    ownedForExchange: listOwnedHousing(p.user_id).map((row) => {
      const prop = getHousingProperty(row.city_id, row.property_id);
      const catalog = prop?.priceRub ?? getHousingPrices(row.city_id).buyRub;
      const other = getCity(row.city_id);
      return {
        id: row.id,
        cityId: row.city_id,
        cityName: other?.name ?? row.city_id,
        title: prop ? housingPropertyLabel(prop) : row.property_id,
        tradeInRub: computeResaleValue(catalog, "housing", row.acquired_at, now, "trade_in"),
        tradeInRateHint: housingTradeInRateHint(row.acquired_at, now),
        isSublet: isSubletActive(row, now),
      };
    }),
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
      subletOthersIncomeRub += subletIncomeForOwned(other, SUBLET_MONTH_MS);
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
      error: `Не хватает денег (нужно ${formatRub(totalCost)})`,
    };
  }

  const patch: Partial<PlayerRow> = {
    ...applyOwnedResidence(p, row),
    rubles: p.rubles - totalCost,
  };
  if (
    p.housing_type != null &&
    (p.housing_type !== "owned" || p.housing_owned_id !== row.id)
  ) {
    pushCurrentResidenceToStack(p);
  }

  clearSublet(row.id);
  updatePlayer(p.user_id, patch);
  p = getPlayer(p.user_id)!;

  const income = subletOtherOwnedMonthly(p, row.id, now, true);

  const parts: string[] = [`Теперь вы живёте: ${quote.title} (${quote.cityName})`];
  if (quote.repayRub > 0) {
    parts.push(`возврат жильцам −${formatRub(quote.repayRub)}`);
  }
  if (income > 0) {
    parts.push(`остальные квартиры сданы (+${formatRub(income)})`);
  }
  const msg = parts.join(". ") + ".";
  appendPlayerFeed(p.user_id, "housing:live", `Переезд: ${quote.title} (${quote.cityName})`, now);
  return { ok: true, message: msg };
}

function payDorm(player: PlayerRow, now: number): HousingPayResult {
  const prices = getHousingPrices(player.city_id);
  if (player.rubles < prices.dormRub) {
    return { ok: false, error: `Не хватает денег (нужно ${formatRub(prices.dormRub)})` };
  }

  const addMs = config.dormHours * MS_HOUR;
  const sameCity = player.housing_city_id === player.city_id;
  const extending =
    sameCity && player.housing_type === "dorm" && player.housing_expires_at != null && player.housing_expires_at > now;
  const extend = extending
    ? extendExpiry(player.housing_expires_at, addMs, now)
    : now + addMs;

  if (extending && extend - now > MAX_DORM_AHEAD_MS) {
    return {
      ok: false,
      error: "Общежитие можно продлить максимум на 7 суток вперёд",
    };
  }

  if (player.housing_type != null && !extending) {
    pushCurrentResidenceToStack(player);
  }

  updatePlayer(player.user_id, {
    rubles: player.rubles - prices.dormRub,
    housing_type: "dorm",
    housing_city_id: player.city_id,
    housing_expires_at: extend,
    housing_owned_id: null,
    housing_property_id: null,
    housing_owned_at: null,
  });

  const fresh = getPlayer(player.user_id)!;
  let income = 0;
  if (extending) {
    income = extendActiveSublets(fresh, addMs, now);
  } else {
    const periodStart = now;
    income = subletVacantOwnedForPeriod(fresh, periodStart, extend, now, true);
  }
  const days = Math.round((extend - (extending ? player.housing_expires_at! : now)) / MS_DAY);
  const msg =
    income > 0
      ? `Общежитие на ${config.dormHours} ч (−${formatRub(prices.dormRub)}). Квартиры сданы/продлены (+${formatRub(income)}).`
      : `Общежитие оплачено на ${config.dormHours} ч (−${formatRub(prices.dormRub)})`;
  appendPlayerFeed(player.user_id, "housing:dorm", msg, now);
  return { ok: true, message: msg };
}

function payRent(player: PlayerRow, now: number): HousingPayResult {
  const prices = getHousingPrices(player.city_id);
  if (player.rubles < prices.rentRub) {
    return { ok: false, error: `Не хватает денег (нужно ${formatRub(prices.rentRub)})` };
  }

  const addMs = config.rentDays * MS_DAY;
  const sameCity = player.housing_city_id === player.city_id;
  const extending =
    sameCity && player.housing_type === "rent" && player.housing_expires_at != null && player.housing_expires_at > now;
  const extend = extending
    ? extendExpiry(player.housing_expires_at, addMs, now)
    : now + addMs;

  if (extending) {
    const remaining = player.housing_expires_at! - now;
    if (remaining >= RENT_EXTEND_WINDOW_MS) {
      return {
        ok: false,
        error: "Продлить аренду можно, когда осталось меньше 7 дней",
      };
    }
  }

  if (player.housing_type != null && !extending) {
    pushCurrentResidenceToStack(player);
  }

  updatePlayer(player.user_id, {
    rubles: player.rubles - prices.rentRub,
    housing_type: "rent",
    housing_city_id: player.city_id,
    housing_expires_at: extend,
    housing_owned_id: null,
    housing_property_id: null,
    housing_owned_at: null,
  });

  const fresh = getPlayer(player.user_id)!;
  let income = 0;
  if (extending) {
    income = extendActiveSublets(fresh, addMs, now);
  } else {
    income = subletVacantOwnedForPeriod(fresh, now, extend, now, true);
  }
  const msg =
    income > 0
      ? `Аренда на ${config.rentDays} дн. (−${formatRub(prices.rentRub)}). Квартиры сданы/продлены (+${formatRub(income)}).`
      : `Аренда на ${config.rentDays} дн. (−${formatRub(prices.rentRub)})`;
  appendPlayerFeed(player.user_id, "housing:rent", msg, now);
  return { ok: true, message: msg };
}

function previewSubletIncomeForPeriod(player: PlayerRow, periodMs: number, now: number): number {
  let sum = 0;
  for (const row of listOwnedHousing(player.user_id)) {
    if (isSubletActive(row, now)) continue;
    sum += subletIncomeForOwned(row, periodMs);
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
      subletNewIncomeRub += subletIncomeForOwned(row, SUBLET_MONTH_MS);
    }
  }
  const totalAfter = listOwnedHousing(p.user_id).length + 1;
  return {
    ...base,
    willMoveIn: totalAfter <= 1,
    subletNewIncomeRub,
  };
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

  const tenantPenalty = subletRepayAmount(row, now);
  if (p.rubles < tenantPenalty) {
    return {
      ok: false,
      error: `Не хватает на возврат жильцам за неиспользованные дни (${formatRub(tenantPenalty)})`,
    };
  }

  const wasHome = p.housing_owned_id === row.id && p.housing_type === "owned";
  clearSublet(row.id);
  deleteOwnedHousing(row.id, p.user_id);

  const rublesAfterSale = p.rubles + sellQuote.amountRub - tenantPenalty;
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
  const penaltyNote =
    tenantPenalty > 0 ? `, жильцам −${formatRub(tenantPenalty)}` : "";
  const message = `${prop?.title ?? "Квартира"} продана (+${formatRub(sellQuote.amountRub)}${penaltyNote})${
    wasHome ? ". Восстановлено прежнее жильё." : ""
  }`;
  appendPlayerFeed(
    p.user_id,
    "housing:sell",
    `Продали «${prop?.title ?? "квартиру"}» (+${formatRub(sellQuote.amountRub)})`,
    now,
  );
  return { ok: true, message };
}

export function payHousingDorm(player: PlayerRow, now = Date.now()): HousingPayResult {
  if (player.status === "traveling") return { ok: false, error: "Вы в пути" };
  return payDorm(syncPlayerHousing(player, now), now);
}

export function payHousingRent(player: PlayerRow, now = Date.now()): HousingPayResult {
  if (player.status === "traveling") return { ok: false, error: "Вы в пути" };
  return payRent(syncPlayerHousing(player, now), now);
}


export const GUEST_WORK_ERROR =
  "Вы гость в этом городе. Оформите жильё в разделе «Недвижимость», чтобы работать.";

export function requireCityResident(player: PlayerRow, now = Date.now()): string | null {
  if (isCityResident(player, player.city_id, now)) return null;
  return GUEST_WORK_ERROR;
}
