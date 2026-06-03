import type { PlayerRow } from "./db.js";
import { getPlayer } from "./db.js";
import { formatMarketLossLossLine } from "./assetTrade.js";
import { quoteCarSell, sellCar } from "./carShop.js";
import { getCarClassLabel } from "./carMarket.js";
import {
  getCarComfort,
  getCarCooldownReducePct,
  getCarPrestige,
  getCarReliability,
  getCarSpeed,
  monthlyMaintenanceRub,
  prestigeToMoodBonus,
} from "./carStats.js";
import { getCar, getPhone, getVehicleRental } from "./gameData.js";
import { getCity } from "./gameData.js";
import {
  housingStatusForPlayer,
  quoteHousingSellById,
  quoteLiveHere,
  sellOwnedHousing,
  subletRepayAmount,
  syncPlayerHousing,
} from "./housing.js";
import { getHousingProperty, housingPropertyLabel } from "./housingCatalog.js";
import { formatLocaleDateRu } from "./formatLocaleDate.js";
import {
  formatVehiclePlate,
  parsePlatePartsFromRow,
  type VehiclePlateParts,
} from "./licensePlate.js";
import { quotePhoneSell, sellPhoneDevice } from "./game.js";
import { getPlayerCarById, getPlayerCarCondition } from "./playerCars.js";
import { formatMileageKm } from "./usedCarMarket.js";
import { formatSimFromPlayer, playerHasSim } from "./simNumber.js";
import { findNextResidence } from "./housingStack.js";
import { getOwnedHousing, isSubletActive } from "./playerOwnedHousing.js";
import { isVehicleRentalActive, playerHasVehicleRentalRecord } from "./vehicleRental.js";
import {
  buildVehicleRentalTimeInfo,
  vehicleRentalDetailStatusRows,
} from "./vehicleRentalDisplay.js";
import { parseTaxiState } from "./playerTaxi.js";

const MS_DAY = 24 * 60 * 60 * 1000;

export type PropertySpecRow = { label: string; value: string };
export type PropertyStatusRow = { label: string; value: string; hint?: string };

export type PropertyDetail = {
  id: string;
  kind: "phone" | "car" | "rental" | "housing";
  title: string;
  subtitle: string | null;
  accent: string;
  specs: PropertySpecRow[];
  features: PropertySpecRow[];
  status: PropertyStatusRow[];
  plate: VehiclePlateParts | null;
  plateText: string | null;
  canSell: boolean;
  sellBlockReason: string | null;
  canCancelRental: boolean;
  cancelBlockReason: string | null;
  rentalRemainingMs?: number | null;
  rentalServerNow?: number | null;
  canLiveHere: boolean;
  housingOwnedId: number | null;
  playerCarId: number | null;
};

export type PropertySellQuote = {
  amountRub: number;
  catalogPriceRub: number;
  resaleRatePct: number;
  deductionsRub: number;
  receiveRub: number;
  losses: string[];
};

type ParsedId =
  | { kind: "phone" }
  | { kind: "car"; playerCarId: number }
  | { kind: "rental" }
  | { kind: "housing-owned"; ownedId: number }
  | { kind: "housing-rent" }
  | { error: string };

function parsePropertyId(propertyId: string): ParsedId {
  if (propertyId === "phone") return { kind: "phone" };
  if (propertyId === "rental") return { kind: "rental" };
  if (propertyId === "housing-rent") return { kind: "housing-rent" };
  const car = /^car-(\d+)$/.exec(propertyId);
  if (car) return { kind: "car", playerCarId: Number(car[1]) };
  const housing = /^housing-(\d+)$/.exec(propertyId);
  if (housing) return { kind: "housing-owned", ownedId: Number(housing[1]) };
  return { error: "Имущество не найдено" };
}

function pct(n: number): string {
  return `${Math.round(n)}%`;
}

export function getPropertyDetail(
  player: PlayerRow,
  propertyId: string,
  now = Date.now(),
): PropertyDetail | { error: string } {
  const parsed = parsePropertyId(propertyId);
  if ("error" in parsed) return parsed;

  const p = syncPlayerHousing(player, now);

  if (parsed.kind === "phone") {
    if (!p.phone_device_id) return { error: "Телефон не найден" };
    const phone = getPhone(p.phone_device_id);
    if (!phone) return { error: "Модель не найдена" };
    const number = playerHasSim(p) ? formatSimFromPlayer(p) : null;
    const status: PropertyStatusRow[] = [];
    if (number) {
      status.push({
        label: "Сим-карта",
        value: number,
        hint: `Баланс: ${Math.floor(p.sim_balance_rub ?? 0).toLocaleString("ru-RU")} ₽`,
      });
    } else {
      status.push({ label: "Сим-карта", value: "не оформлена" });
    }
    return {
      id: propertyId,
      kind: "phone",
      title: `${phone.brand} ${phone.model}`,
      subtitle: number,
      accent: phone.accent,
      specs: [
        { label: "Ёмкость аккумулятора", value: pct(100) },
        { label: "Состояние", value: pct(100) },
      ],
      features: [
        { label: "Экран", value: phone.screen },
        { label: "Память", value: `${phone.ram} · ${phone.storage}` },
        { label: "Батарея (паспорт)", value: phone.battery },
        { label: "Камера", value: phone.camera },
        { label: "Система", value: phone.os },
      ],
      status,
      plate: null,
      plateText: null,
      canSell: true,
      sellBlockReason: null,
      canCancelRental: false,
      cancelBlockReason: null,
      canLiveHere: false,
      housingOwnedId: null,
      playerCarId: null,
    };
  }

  if (parsed.kind === "car") {
    const row = getPlayerCarById(p.user_id, parsed.playerCarId);
    if (!row) return { error: "Автомобиль не найден" };
    const car = getCar(row.car_model_id);
    const plate = parsePlatePartsFromRow(row);
    const plateText = row.plate_text ?? (plate ? formatVehiclePlate(plate) : null);
    const isUsed = Boolean(row.is_used);
    const mileageKm = row.mileage_km ?? 0;
    const cond = getPlayerCarCondition(row);
    const wearSpecs = isUsed
      ? [
          { label: "Пробег", value: formatMileageKm(mileageKm) },
          { label: "Двигатель", value: `${cond.engine}%` },
          { label: "КПП", value: `${cond.transmission}%` },
          { label: "Шины", value: `${cond.tires}%` },
          { label: "Сход-развал", value: `${cond.alignment}%` },
          { label: "Кузов", value: `${cond.body}%` },
          { label: "Электроника", value: `${cond.electronics}%` },
          { label: "Салон", value: `${cond.interior}%` },
        ]
      : [];
    return {
      id: propertyId,
      kind: "car",
      title: car ? `${car.brand} ${car.model}` : "Автомобиль",
      subtitle: car
        ? `${car.year} · ${car.body}${isUsed ? " · б/у" : ""}`
        : null,
      accent: car?.accent ?? "#4a5568",
      specs: car
        ? [
            { label: "Класс", value: getCarClassLabel(car.carClass ?? "economy") },
            { label: "Скорость", value: `${getCarSpeed(car)} (−${getCarCooldownReducePct(car)}% КД доставки)` },
            { label: "Комфорт", value: String(getCarComfort(car)) },
            { label: "Надёжность", value: String(getCarReliability(car)) },
            { label: "Престиж", value: `${getCarPrestige(car)} (+${prestigeToMoodBonus(getCarPrestige(car))} настроения)` },
            {
              label: "ТО в месяц",
              value: `${monthlyMaintenanceRub(car, row.purchase_price_rub ?? car.priceRub).toLocaleString("ru-RU")} ₽`,
            },
          ]
        : [],
      features: car
        ? [
            { label: "Кузов", value: car.body },
            { label: "Год", value: String(car.year) },
            { label: "Расход", value: `${car.fuelConsumption ?? 50}/100` },
            ...wearSpecs,
          ]
        : wearSpecs,
      status: plateText
        ? [{ label: "Госномер", value: plateText }]
        : [{ label: "Госномер", value: "не зарегистрирован" }],
      plate,
      plateText,
      canSell: true,
      sellBlockReason: null,
      canCancelRental: false,
      cancelBlockReason: null,
      canLiveHere: false,
      housingOwnedId: null,
      playerCarId: row.id,
    };
  }

  if (parsed.kind === "rental") {
    if (!playerHasVehicleRentalRecord(p)) {
      return { error: "Аренда не найдена" };
    }
    const rental = getVehicleRental(p.vehicle_rental_id!);
    const active = isVehicleRentalActive(p, now);
    const timeInfo = buildVehicleRentalTimeInfo(p, now);
    const taxiState = parseTaxiState(p);
    let cancelBlockReason: string | null = null;
    if (taxiState?.onLine) cancelBlockReason = "Сначала завершите линию такси";
    else if (taxiState?.activeTrip) cancelBlockReason = "Дождитесь окончания поездки";

    const status: PropertyStatusRow[] = timeInfo ? vehicleRentalDetailStatusRows(timeInfo) : [];

    if (rental?.taxiCarModelId) {
      status.push({
        label: "Такси",
        value: active ? "подходит для работы таксистом" : "не подходит — аренда истекла",
      });
    } else {
      status.push({
        label: "Такси",
        value: "не подходит (нужно «Авто (эконом)» или свой автомобиль)",
      });
    }

    return {
      id: propertyId,
      kind: "rental",
      title: rental?.label ?? "Аренда транспорта",
      subtitle: active ? timeInfo?.remainingLabel ?? null : "истекла",
      accent: rental?.accent ?? "#2d8f5c",
      specs: [
        { label: "Пробег", value: "0 км" },
        { label: "Износ шин", value: pct(0) },
      ],
      features: [],
      status,
      plate: null,
      plateText: null,
      canSell: false,
      sellBlockReason: null,
      canCancelRental: cancelBlockReason == null,
      cancelBlockReason,
      rentalRemainingMs: timeInfo?.remainingMs ?? null,
      rentalServerNow: timeInfo?.serverNow ?? null,
      canLiveHere: false,
      housingOwnedId: null,
      playerCarId: null,
    };
  }

  if (parsed.kind === "housing-rent") {
    const housing = housingStatusForPlayer(p, now);
    if (!housing.isResident || p.housing_type === "owned") {
      return { error: "Жильё не найдено" };
    }
    const city = p.housing_city_id ? getCity(p.housing_city_id) : null;
    const label = p.housing_type === "rent" ? "Аренда квартиры" : "Общежитие";
    return {
      id: propertyId,
      kind: "housing",
      title: `${label} (${city?.name ?? p.housing_city_id ?? ""})`,
      subtitle: null,
      accent: "#4a6fa5",
      specs: [],
      features: [],
      status: [
        { label: "Статус", value: "Вы живёте здесь" },
        {
          label: "Оплачено до",
          value: housing.expiresAt
            ? formatLocaleDateRu(housing.expiresAt, { withTime: true })
            : "—",
        },
        {
          label: "Регистрация",
          value: city?.name ?? p.housing_city_id ?? "—",
          hint: "Для работы в этом городе",
        },
      ],
      plate: null,
      plateText: null,
      canSell: false,
      sellBlockReason: "Снимаемое жильё не продаётся — продлите в разделе «Недвижимость»",
      canCancelRental: false,
      cancelBlockReason: null,
      canLiveHere: false,
      housingOwnedId: null,
      playerCarId: null,
    };
  }

  const row = getOwnedHousing(parsed.ownedId, p.user_id);
  if (!row) return { error: "Квартира не найдена" };
  const prop = getHousingProperty(row.city_id, row.property_id);
  const city = getCity(row.city_id);
  const cityName = city?.name ?? row.city_id;
  const isActive =
    p.housing_type === "owned" && p.housing_owned_id === row.id && !isSubletActive(row, now);
  const sublet = isSubletActive(row, now);

  const status: PropertyStatusRow[] = [];
  if (isActive) {
    status.push({ label: "Проживание", value: "Вы живёте здесь" });
  } else if (sublet) {
    status.push({ label: "Сдача", value: "Сдаётся" });
    if (row.sublet_from != null && row.sublet_until != null) {
      status.push({
        label: "Период сдачи",
        value: `${formatLocaleDateRu(row.sublet_from)} — ${formatLocaleDateRu(row.sublet_until)}`,
        hint: "При переезде сюда или продаже — возврат жильцам только за неиспользованные дни",
      });
    }
    status.push({
      label: "Чистый доход / нед.",
      value: `${(prop?.weeklyNetIncomeRub ?? 0).toLocaleString("ru-RU")} ₽`,
      hint: prop
        ? `За период до ${row.sublet_income_rub.toLocaleString("ru-RU")} ₽ (выплаты еженедельно, получено ${row.sublet_paid_rub.toLocaleString("ru-RU")} ₽)`
        : undefined,
    });
  } else {
    status.push({ label: "Сдача", value: "Не сдаётся" });
    status.push({
      label: "Проживание",
      value: "Вы не живёте здесь",
      hint: "Можно переехать или сдать на 30 дней",
    });
  }

  const sellBlock =
    p.city_id !== row.city_id
      ? `Продать можно только находясь в ${cityName}`
      : null;

  return {
    id: propertyId,
    kind: "housing",
    title: prop?.title ?? "Квартира",
    subtitle: `${cityName} · ${prop?.district ?? ""}`,
    accent: "#5a4a7a",
    specs: [
      { label: "Состояние", value: pct(100) },
      ...(prop?.description ? [{ label: "Описание", value: prop.description }] : []),
    ],
    features: prop
      ? [
          { label: "Престиж", value: `${prop.prestige}/100` },
          { label: "Комнаты", value: prop.rooms },
          { label: "Площадь", value: `${prop.areaSqm} м²` },
          { label: "Стоимость", value: `${prop.priceRub.toLocaleString("ru-RU")} ₽` },
          {
            label: "Аренда / мес.",
            value: `${prop.monthlyRentRub.toLocaleString("ru-RU")} ₽`,
          },
          {
            label: "Чистый доход / нед.",
            value: `${prop.weeklyNetIncomeRub.toLocaleString("ru-RU")} ₽`,
            hint: `≈ ${prop.monthlyNetIncomeRub.toLocaleString("ru-RU")} ₽/мес после расходов ${prop.monthlyExpensesRub.toLocaleString("ru-RU")} ₽`,
          },
        ]
      : [],
    status,
    plate: null,
    plateText: null,
    canSell: sellBlock == null,
    sellBlockReason: sellBlock,
    canCancelRental: false,
    cancelBlockReason: null,
    canLiveHere: !isActive,
    housingOwnedId: row.id,
    playerCarId: null,
  };
}

export function getPropertySellQuote(
  player: PlayerRow,
  propertyId: string,
  now = Date.now(),
): PropertySellQuote | { error: string } {
  const detail = getPropertyDetail(player, propertyId, now);
  if ("error" in detail) return detail;
  if (!detail.canSell) {
    return { error: detail.sellBlockReason ?? "Продажа недоступна" };
  }

  const p = syncPlayerHousing(player, now);

  if (detail.kind === "phone") {
    const q = quotePhoneSell(p, now);
    if ("error" in q) return q;
    return {
      amountRub: q.amountRub,
      catalogPriceRub: q.catalogPriceRub,
      resaleRatePct: 60,
      deductionsRub: 0,
      receiveRub: q.amountRub,
      losses: [
        `Телефон ${detail.title} будет продан`,
        "Сим-карта и номер останутся у вас",
        formatMarketLossLossLine(q.catalogPriceRub, q.amountRub),
      ],
    };
  }

  if (detail.kind === "car" && detail.playerCarId != null) {
    const q = quoteCarSell(p, detail.playerCarId, now);
    if ("error" in q) return q;
    return {
      amountRub: q.amountRub,
      catalogPriceRub: q.catalogPriceRub,
      resaleRatePct: 80,
      deductionsRub: 0,
      receiveRub: q.amountRub,
      losses: [
        `Автомобиль «${q.carName}» будет продан`,
        detail.plateText ? `Госномер ${detail.plateText} перестанет быть вашим` : "Госномер будет снят",
        formatMarketLossLossLine(q.catalogPriceRub, q.amountRub),
      ],
    };
  }

  if (detail.kind === "housing" && detail.housingOwnedId != null) {
    const row = getOwnedHousing(detail.housingOwnedId, p.user_id)!;
    const sellQ = quoteHousingSellById(p, row.id, now);
    if ("error" in sellQ) return sellQ;
    const penalty = subletRepayAmount(row, now);
    const wasHome = p.housing_owned_id === row.id && p.housing_type === "owned";
    const losses: string[] = [`Квартира «${detail.title}» (${detail.subtitle}) будет продана`];
    if (penalty > 0) {
      losses.push(
        `Возврат жильцам за неиспользованные дни сдачи: −${penalty.toLocaleString("ru-RU")} ₽`,
      );
    }
    if (wasHome) {
      const next = findNextResidence(p, now, { skipOwnedIds: [row.id] });
      losses.push(
        next ? `Автоматически переедете в ${next.label}` : "Останетесь без жилья",
      );
    }
    if (isSubletActive(row, now)) {
      losses.push("Активная сдача будет прекращена");
    }
    losses.push(formatMarketLossLossLine(sellQ.catalogPriceRub, sellQ.amountRub));
    return {
      amountRub: sellQ.amountRub,
      catalogPriceRub: sellQ.catalogPriceRub,
      resaleRatePct: 60,
      deductionsRub: penalty,
      receiveRub: sellQ.amountRub - penalty,
      losses,
    };
  }

  return { error: "Продажа недоступна" };
}

export function sellPropertyById(
  userId: number,
  propertyId: string,
  now = Date.now(),
): { ok: true; message: string; receiveRub: number } | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };

  const quote = getPropertySellQuote(player, propertyId, now);
  if ("error" in quote) return { ok: false, error: quote.error };

  const parsed = parsePropertyId(propertyId);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  if (parsed.kind === "phone") {
    const r = sellPhoneDevice(userId);
    if (!r.ok) return r;
    return {
      ok: true,
      message: `Телефон продан (+${r.amountRub.toLocaleString("ru-RU")} ₽). Сим-карта сохранена.`,
      receiveRub: r.amountRub,
    };
  }

  if (parsed.kind === "car") {
    const r = sellCar(userId, parsed.playerCarId);
    if (!r.ok) return r;
    return {
      ok: true,
      message: `Автомобиль продан (+${r.amountRub.toLocaleString("ru-RU")} ₽)`,
      receiveRub: r.amountRub,
    };
  }

  if (parsed.kind === "housing-owned") {
    const p = syncPlayerHousing(getPlayer(userId)!, now);
    const r = sellOwnedHousing(p, parsed.ownedId, now);
    if (!r.ok) return r;
    const receive = quote.receiveRub;
    return { ok: true, message: r.message, receiveRub: receive };
  }

  return { ok: false, error: "Продажа недоступна" };
}

/** Для подсказки при «Жить здесь» на экране детали. */
export function getLiveHerePreviewForProperty(
  player: PlayerRow,
  propertyId: string,
  now = Date.now(),
) {
  const parsed = parsePropertyId(propertyId);
  if ("error" in parsed || parsed.kind !== "housing-owned") return null;
  return quoteLiveHere(player, parsed.ownedId, now);
}
