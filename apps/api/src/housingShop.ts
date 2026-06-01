import type { PlayerRow } from "./db.js";
import { getPlayer, updatePlayer } from "./db.js";
import { computeResaleValue } from "./assetTrade.js";
import { getHousingProperty, housingPropertyLabel } from "./housingCatalog.js";
import { getCity } from "./gameData.js";
import {
  getHousingPrices,
  payLiveHere,
  quoteHousingBuy,
  subletIncomeForPeriod,
  subletOtherOwnedMonthly,
  syncPlayerHousing,
} from "./housing.js";
import { pushCurrentResidenceToStack } from "./housingStack.js";
import {
  deleteOwnedHousing,
  findOwnedHousing,
  getOwnedHousing,
  insertOwnedHousing,
  isSubletActive,
  listOwnedHousing,
  updateOwnedHousing,
} from "./playerOwnedHousing.js";

const MS_DAY = 24 * 60 * 60 * 1000;

export type HousingPurchaseQuote = {
  listPriceRub: number;
  tradeInRub: number;
  netPriceRub: number;
  excessRub: number;
  propertyId: string;
  propertyTitle: string;
  tradeInUnits: { id: number; title: string; amountRub: number }[];
};

function tradeInValueForOwned(
  row: { city_id: string; property_id: string; acquired_at: number },
  now: number,
): number {
  const prop = getHousingProperty(row.city_id, row.property_id);
  const catalogPriceRub = prop?.priceRub ?? getHousingPrices(row.city_id).buyRub;
  return computeResaleValue(catalogPriceRub, "housing", row.acquired_at, now, "trade_in");
}

export function listOwnedForExchange(player: PlayerRow, now = Date.now()) {
  return listOwnedHousing(player.user_id).map((row) => {
    const prop = getHousingProperty(row.city_id, row.property_id);
    const city = getCity(row.city_id);
    return {
      id: row.id,
      cityId: row.city_id,
      cityName: city?.name ?? row.city_id,
      propertyId: row.property_id,
      title: prop ? housingPropertyLabel(prop) : row.property_id,
      tradeInRub: tradeInValueForOwned(row, now),
      isSublet: isSubletActive(row, now),
    };
  });
}

export function quoteHousingPurchase(
  player: PlayerRow,
  propertyId: string,
  sellOwnedIds: number[] = [],
  now = Date.now(),
): HousingPurchaseQuote | { error: string } {
  const p = syncPlayerHousing(player, now);
  const base = quoteHousingBuy(p, propertyId, now);
  if ("error" in base) return base;

  const tradeInUnits: HousingPurchaseQuote["tradeInUnits"] = [];
  let tradeInRub = 0;
  const seen = new Set<number>();

  for (const oid of sellOwnedIds) {
    if (seen.has(oid)) continue;
    seen.add(oid);
    const row = getOwnedHousing(oid, p.user_id);
    if (!row) return { error: "Квартира для зачёта не найдена" };
    const amountRub = tradeInValueForOwned(row, now);
    tradeInRub += amountRub;
    const prop = getHousingProperty(row.city_id, row.property_id);
    tradeInUnits.push({
      id: row.id,
      title: prop ? housingPropertyLabel(prop) : row.property_id,
      amountRub,
    });
  }

  const net = base.listPriceRub - tradeInRub;
  const excessRub = net < 0 ? -net : 0;
  const netPriceRub = Math.max(0, net);

  return {
    listPriceRub: base.listPriceRub,
    tradeInRub,
    netPriceRub,
    excessRub,
    propertyId: base.propertyId,
    propertyTitle: base.propertyTitle,
    tradeInUnits,
  };
}

export type HousingBuyResult =
  | { ok: true; message: string; needsPostChoice: boolean; ownedId: number }
  | { ok: false; error: string };

export function buyHousingCash(
  player: PlayerRow,
  propertyId: string,
  now = Date.now(),
): HousingBuyResult {
  const quote = quoteHousingPurchase(player, propertyId, [], now);
  if ("error" in quote) return { ok: false, error: quote.error };
  return completeHousingPurchase(player, propertyId, [], quote, now);
}

export function buyHousingWithSell(
  player: PlayerRow,
  propertyId: string,
  sellOwnedIds: number[],
  now = Date.now(),
): HousingBuyResult {
  if (sellOwnedIds.length === 0) {
    return { ok: false, error: "Выберите хотя бы одну квартиру для зачёта" };
  }
  const quote = quoteHousingPurchase(player, propertyId, sellOwnedIds, now);
  if ("error" in quote) return { ok: false, error: quote.error };
  return completeHousingPurchase(player, propertyId, sellOwnedIds, quote, now);
}

function completeHousingPurchase(
  player: PlayerRow,
  propertyId: string,
  sellOwnedIds: number[],
  quote: HousingPurchaseQuote,
  now: number,
): HousingBuyResult {
  let p = syncPlayerHousing(player, now);
  if (p.status === "traveling") return { ok: false, error: "Вы в пути" };
  if (findOwnedHousing(p.user_id, p.city_id, propertyId)) {
    return { ok: false, error: "Эта квартира у вас уже есть" };
  }
  if (p.rubles < quote.netPriceRub) {
    return {
      ok: false,
      error: `Не хватает денег (нужно ${quote.netPriceRub.toLocaleString("ru-RU")} ₽)`,
    };
  }

  const hadResidence = p.housing_type != null;
  if (hadResidence) pushCurrentResidenceToStack(p);

  for (const oid of sellOwnedIds) {
    deleteOwnedHousing(oid, p.user_id);
  }

  const ownedId = insertOwnedHousing(p.user_id, p.city_id, propertyId, now);
  const totalOwned = listOwnedHousing(p.user_id).length;
  const needsPostChoice = totalOwned > 1;

  const rublesAfter = p.rubles - quote.netPriceRub + quote.excessRub;
  if (!needsPostChoice) {
    const row = getOwnedHousing(ownedId, p.user_id)!;
    updatePlayer(p.user_id, {
      rubles: rublesAfter,
      housing_type: "owned",
      housing_city_id: row.city_id,
      housing_property_id: row.property_id,
      housing_owned_id: row.id,
      housing_owned_at: row.acquired_at,
      housing_expires_at: null,
    });
    p = getPlayer(p.user_id)!;
    const income = subletOtherOwnedMonthly(p, ownedId, now, true);
    const prop = getHousingProperty(p.city_id, propertyId);
    const msg =
      income > 0
        ? `${prop?.title ?? "Квартира"} куплена. Вы переехали. Остальные сданы (+${income.toLocaleString("ru-RU")} ₽).`
        : `${prop?.title ?? "Квартира"} куплена. Вы переехали.`;
    return { ok: true, message: msg, needsPostChoice: false, ownedId };
  }

  updatePlayer(p.user_id, {
    rubles: rublesAfter,
    housing_pending_owned_id: ownedId,
  });
  const prop = getHousingProperty(p.city_id, propertyId);
  return {
    ok: true,
    message: `${prop?.title ?? "Квартира"} куплена. Выберите: переехать или сдавать.`,
    needsPostChoice: true,
    ownedId,
  };
}

export function afterBuyHousingChoice(
  player: PlayerRow,
  ownedId: number,
  mode: "live" | "sublet",
  now = Date.now(),
): { ok: true; message: string } | { ok: false; error: string } {
  const row = getOwnedHousing(ownedId, player.user_id);
  if (!row) return { ok: false, error: "Квартира не найдена" };
  if (mode === "live") {
    updatePlayer(player.user_id, { housing_pending_owned_id: null });
    const r = payLiveHere(player, ownedId, now);
    return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error };
  }
  updatePlayer(player.user_id, { housing_pending_owned_id: null });
  const p = syncPlayerHousing(player, now);
  if (isSubletActive(row, now)) {
    return { ok: false, error: "Квартира уже сдаётся" };
  }
  const periodEnd = now + 30 * MS_DAY;
  const income = subletIncomeForPeriod(row.city_id, 30 * MS_DAY);
  updateOwnedHousing(row.id, {
    sublet_from: now,
    sublet_until: periodEnd,
    sublet_income_rub: income,
    sublet_retry_at: null,
    sublet_retry_chance: null,
  });
  updatePlayer(p.user_id, { rubles: p.rubles + income });
  const prop = getHousingProperty(row.city_id, row.property_id);
  return {
    ok: true,
    message: `${prop?.title ?? "Квартира"} сдаётся 30 дн. (+${income.toLocaleString("ru-RU")} ₽).`,
  };
}
