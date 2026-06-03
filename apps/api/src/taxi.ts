import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PlayerRow } from "./db.js";
import { getPlayer, updatePlayer } from "./db.js";
import { appendPlayerFeed } from "./playerFeed.js";
import { DATA_DIR } from "./config.js";
import { randInt } from "./random.js";
import { findCityJob, getCar, getVehicleRental, type JobDef } from "./gameData.js";
import { taxiClassForCarModel } from "./carStats.js";
import {
  acceptBlockReasonForOrder,
  canCarFulfillOrderTariff,
  orderTariffsAvailableToCar,
  pickWeightedOrderTariff,
  TAXI_TARIFF_ORDER,
} from "./taxiTariff.js";
import { getCitySalaryMultiplier, skillPayoutMultiplier } from "./jobSalaries.js";
import { recordSkillAction, SKILL_LABELS } from "./skills.js";
import { listPlayerCars, playerHasAnyCar } from "./playerCars.js";
import {
  hasActiveTaxiTrip,
  parseTaxiState,
  saveTaxiState,
  taxiBlocksWork,
  type TaxiActiveTrip,
  type TaxiOrder,
  type TaxiState,
} from "./playerTaxi.js";
import { clampVital } from "./playerStats.js";
import { jobCityId } from "./jobLocation.js";
import { isVehicleRentalActive } from "./vehicleRental.js";
import {
  cashPaymentRiskChances,
  rollTripMinutes,
  tripPayoutRub,
  type TaxiCashRiskConfig,
  type TaxiPayoutCurve,
} from "./taxiPayout.js";

type TaxiConfig = {
  idleOfflineMs: number;
  ordersRefreshMs: number;
  ordersPerPool: number;
  ratingDefault: number;
  ratingMin: number;
  ratingMax: number;
  ratingDeclinePenalty: number;
  ratingGoodTripBonus: number;
  ratingBadTripPenalty: number;
  cashNoPayBaseChance: number;
  cashPartialPayBaseChance: number;
  cashNoPayPerRatingBelow45: number;
  cashPartialPayPerRatingBelow45: number;
  cashPartialPayFraction: number;
  parkCompensationFraction: number;
  tripMinutesMin: number;
  tripMinutesMax: number;
  midTripMinutes: number;
  hourlyAtMinTrip: number;
  hourlyAtMidTrip: number;
  hourlyAtMaxTrip: number;
  energyPerOrderBase: number;
  energyConflictExtra: number;
  energyLongTripExtra: number;
  longTripMinutes: number;
  tariffs: Record<string, { title: string; orderMult: number; minCityMultiplier: number }>;
  carClassByPrice: { maxPriceRub: number | null; class: string }[];
  cityTariffs: Record<string, string[]>;
};

const taxiConfig = JSON.parse(
  readFileSync(join(DATA_DIR, "taxiConfig.json"), "utf-8"),
) as TaxiConfig;

const payoutCurve: TaxiPayoutCurve = {
  tripMinutesMin: taxiConfig.tripMinutesMin,
  tripMinutesMax: taxiConfig.tripMinutesMax,
  midTripMinutes: taxiConfig.midTripMinutes,
  hourlyAtMinTrip: taxiConfig.hourlyAtMinTrip,
  hourlyAtMidTrip: taxiConfig.hourlyAtMidTrip,
  hourlyAtMaxTrip: taxiConfig.hourlyAtMaxTrip,
};

const cashRiskConfig: TaxiCashRiskConfig = {
  cashNoPayBaseChance: taxiConfig.cashNoPayBaseChance,
  cashPartialPayBaseChance: taxiConfig.cashPartialPayBaseChance,
  cashNoPayPerRatingBelow45: taxiConfig.cashNoPayPerRatingBelow45,
  cashPartialPayPerRatingBelow45: taxiConfig.cashPartialPayPerRatingBelow45,
  cashPartialPayFraction: taxiConfig.cashPartialPayFraction,
  parkCompensationFraction: taxiConfig.parkCompensationFraction,
};

const MS_MIN = 60_000;

function clampRating(r: number): number {
  return Math.max(taxiConfig.ratingMin, Math.min(taxiConfig.ratingMax, Math.round(r * 100) / 100));
}

export function taxiCarClassForModel(carModelId: string): string {
  const car = getCar(carModelId);
  if (!car) return "economy";
  return taxiClassForCarModel(car);
}

export function availableTariffsForCity(cityId: string): string[] {
  return taxiConfig.cityTariffs[cityId] ?? taxiConfig.cityTariffs.omsk ?? ["economy", "comfort"];
}

function tariffAllowedInCity(cityId: string, taxiClass: string): boolean {
  const list = availableTariffsForCity(cityId);
  if (list.includes(taxiClass)) return true;
  const maxIdx = Math.max(...list.map((t) => TAXI_TARIFF_ORDER.indexOf(t as (typeof TAXI_TARIFF_ORDER)[number])));
  const idx = TAXI_TARIFF_ORDER.indexOf(taxiClass as (typeof TAXI_TARIFF_ORDER)[number]);
  return idx >= 0 && idx <= maxIdx;
}

export type TaxiCarOption = {
  source: "owned" | "rental";
  refId: number;
  modelId: string;
  label: string;
  taxiClass: string;
  tariffTitle: string;
};

export function listTaxiCarOptions(player: PlayerRow, now = Date.now()): TaxiCarOption[] {
  const options: TaxiCarOption[] = [];
  for (const row of listPlayerCars(player.user_id)) {
    const car = getCar(row.car_model_id);
    const taxiClass = taxiCarClassForModel(row.car_model_id);
    const tariff = taxiConfig.tariffs[taxiClass];
    options.push({
      source: "owned",
      refId: row.id,
      modelId: row.car_model_id,
      label: car ? `${car.brand} ${car.model}` : row.car_model_id,
      taxiClass,
      tariffTitle: tariff?.title ?? taxiClass,
    });
  }
  const rentalId = player.vehicle_rental_id;
  if (rentalId && isVehicleRentalActive(player, now)) {
    const rental = getVehicleRental(rentalId);
    const modelId = rental?.taxiCarModelId;
    if (!modelId) return options;
    const taxiClass = taxiCarClassForModel(modelId);
    options.push({
      source: "rental",
      refId: 0,
      modelId,
      label: rental?.label ?? "Аренда",
      taxiClass,
      tariffTitle: taxiConfig.tariffs[taxiClass]?.title ?? taxiClass,
    });
  }
  return options;
}

function generateOrder(player: PlayerRow, orderTariff: string): TaxiOrder {
  const cityMult = getCitySalaryMultiplier(player.city_id);
  const tariffDef = taxiConfig.tariffs[orderTariff] ?? taxiConfig.tariffs.economy!;
  const tripMinutes = rollTripMinutes(payoutCurve);
  const passengerRating =
    Math.random() < 0.65
      ? randInt(42, 50) / 10
      : Math.random() < 0.5
        ? randInt(35, 41) / 10
        : randInt(30, 34) / 10;
  const payment: "card" | "cash" = Math.random() < 0.38 ? "cash" : "card";
  const omskRub = tripPayoutRub(tripMinutes, payoutCurve);
  const skillMult = skillPayoutMultiplier(player, "taxi");
  const payoutRub = Math.max(
    150,
    Math.round(omskRub * cityMult * tariffDef.orderMult * skillMult),
  );

  return {
    id: `o-${Date.now()}-${randInt(1000, 9999)}`,
    tripMinutes,
    passengerRating,
    payment,
    payoutRub,
    tariff: orderTariff,
    tariffTitle: tariffDef.title,
    offeredAt: Date.now(),
  };
}

function generateOrderPool(player: PlayerRow, state: TaxiState): TaxiOrder[] {
  const count = taxiConfig.ordersPerPool;
  const cityTariffs = availableTariffsForCity(player.city_id);
  const allowedTariffs = orderTariffsAvailableToCar(cityTariffs, state.taxiClass);
  const orders: TaxiOrder[] = [];
  const usedIds = new Set<string>();
  while (orders.length < count) {
    const orderTariff = pickWeightedOrderTariff(allowedTariffs);
    const o = generateOrder(player, orderTariff);
    if (!usedIds.has(o.id)) {
      usedIds.add(o.id);
      orders.push(o);
    }
  }
  return orders;
}

function refreshOrderPool(player: PlayerRow, state: TaxiState, now: number): TaxiState {
  return {
    ...state,
    availableOrders: generateOrderPool(player, state),
    ordersRefreshAt: now + taxiConfig.ordersRefreshMs,
    lastActivityAt: now,
  };
}

function syncIdleOffline(state: TaxiState, now: number): TaxiState {
  if (!state.onLine && !state.activeTrip) return state;
  if (state.activeTrip) return state;
  if (state.onLine && now - state.lastActivityAt >= taxiConfig.idleOfflineMs) {
    return {
      ...state,
      onLine: false,
      availableOrders: [],
      ordersRefreshAt: 0,
    };
  }
  return state;
}

function completeActiveTrip(
  player: PlayerRow,
  job: JobDef,
  state: TaxiState,
  now: number,
): { state: TaxiState; payoutRub: number; message: string; moodDelta: number } {
  const trip = state.activeTrip!;
  const order = trip.order;
  let payoutRub = order.payoutRub;
  let moodDelta = 0;
  let payNote = "";

  if (order.passengerRating >= 4.5) moodDelta += randInt(0, 2);
  else if (order.passengerRating < 3.5) moodDelta -= randInt(1, 3);

  if (order.payment === "cash") {
    const { noPayChance, partialPayChance } = cashPaymentRiskChances(
      order.passengerRating,
      cashRiskConfig,
    );
    if (Math.random() < noPayChance) {
      payoutRub = Math.floor(payoutRub * cashRiskConfig.parkCompensationFraction);
      payNote = " Пассажир не заплатил — таксопарк компенсировал часть.";
      moodDelta -= 2;
    } else if (Math.random() < partialPayChance) {
      payoutRub = Math.floor(payoutRub * cashRiskConfig.cashPartialPayFraction);
      payNote = " Неполная оплата наличными.";
      moodDelta -= 1;
    }
  }

  const reviewRoll = Math.random();
  let rating = state.rating;
  if (order.passengerRating >= 4.5 && reviewRoll < 0.35) {
    rating = clampRating(rating + taxiConfig.ratingGoodTripBonus);
  } else if (order.passengerRating < 3.5 && reviewRoll < 0.4) {
    rating = clampRating(rating - taxiConfig.ratingBadTripPenalty);
  }

  const mood = clampVital("mood", (player.mood ?? 70) + moodDelta);
  const skillResult = recordSkillAction(player, "taxi_trips");
  const skillPatch = skillResult.patch;
  updatePlayer(player.user_id, {
    mood,
    rubles: player.rubles + payoutRub,
    ...skillPatch,
  });
  if (skillResult.granted) {
    const label = SKILL_LABELS[skillResult.granted.key];
    appendPlayerFeed(
      player.user_id,
      "work:taxi",
      `Навык: +${skillResult.granted.amount} ${label}`,
      now,
    );
  }

  let next: TaxiState = {
    ...state,
    activeTrip: null,
    sessionIncomeRub: state.sessionIncomeRub + payoutRub,
    ordersCompleted: state.ordersCompleted + 1,
    rating,
    lastActivityAt: now,
  };

  if (next.onLine) {
    next = refreshOrderPool(player, next, now);
  } else {
    next = { ...next, availableOrders: [], ordersRefreshAt: 0 };
  }

  const msg = `Поездка ${order.tripMinutes} мин · +${payoutRub.toLocaleString("ru-RU")} ₽${payNote}`;
  return { state: next, payoutRub, message: msg, moodDelta };
}

/** Синхронизация: завершение поездки, обновление пула заказов. */
function ensureValidTaxiCar(player: PlayerRow, state: TaxiState, now: number): TaxiState | null {
  if (!state.carSelected) return state;
  const cars = listTaxiCarOptions(player, now);
  const valid = cars.some((c) => c.source === state.carSource && c.refId === state.carRefId);
  if (valid) return state;
  if (state.activeTrip) {
    return { ...state, onLine: false, availableOrders: [], ordersRefreshAt: 0 };
  }
  return null;
}

export function advanceTaxiState(
  player: PlayerRow,
  job: JobDef | undefined,
  state: TaxiState,
  now: number,
): { state: TaxiState; completedMessage?: string; completedPayout?: number } {
  let s = ensureValidTaxiCar(player, state, now);
  if (s === null) {
    saveTaxiState(player.user_id, null);
    return {
      state: {
        ...state,
        carSelected: false,
        onLine: false,
        availableOrders: [],
        ordersRefreshAt: 0,
        activeTrip: state.activeTrip,
      },
    };
  }
  s = syncIdleOffline(s, now);
  let completedMessage: string | undefined;
  let completedPayout: number | undefined;

  if (s.activeTrip && now >= s.activeTrip.endsAt && job) {
    const fresh = getPlayer(player.user_id) ?? player;
    const result = completeActiveTrip(fresh, job, s, now);
    if (result.payoutRub > 0) {
      s = result.state;
      completedMessage = result.message;
      completedPayout = result.payoutRub;
      appendPlayerFeed(player.user_id, "work:taxi", `Заказ: ${result.message}`, now);
    } else if (result.message && result.payoutRub === 0) {
      return { state: s, completedMessage: result.message };
    }
  }

  if (s.onLine && !s.activeTrip) {
    if (s.availableOrders.length === 0 || now >= s.ordersRefreshAt) {
      s = refreshOrderPool(player, s, now);
    }
  }

  saveTaxiState(player.user_id, s.onLine || s.carSelected ? s : null);
  return { state: s, completedMessage, completedPayout };
}

export type TaxiActiveTripView = {
  orderId: string;
  startedAt: number;
  endsAt: number;
  remainingMs: number;
  order: TaxiOrder;
};

export type TaxiOrderView = TaxiOrder & {
  canAccept: boolean;
  acceptBlockReason?: string | null;
};

export type TaxiStatus = {
  carSelected: boolean;
  onLine: boolean;
  rating: number;
  sessionIncomeRub: number;
  ordersCompleted: number;
  ordersDeclined: number;
  carLabel: string | null;
  taxiClass: string | null;
  taxiClassTitle: string | null;
  selectedCarKey: string | null;
  availableOrders: TaxiOrderView[];
  activeTrip: TaxiActiveTripView | null;
  ordersRefreshAt: number;
  ordersRefreshInMs: number;
  targetIncomeRub: number;
  payoutMin: number;
  payoutMax: number;
  availableCars: TaxiCarOption[];
  cityTariffs: string[];
  completedMessage?: string;
  completedPayout?: number;
};

function carKey(c: { source: string; refId: number }) {
  return `${c.source}:${c.refId}`;
}

export function getTaxiStatus(player: PlayerRow, job: JobDef, now = Date.now()): TaxiStatus {
  let state = parseTaxiState(player);
  let completedMessage: string | undefined;
  let completedPayout: number | undefined;

  if (state) {
    const advanced = advanceTaxiState(player, job, state, now);
    state = advanced.state;
    completedMessage = advanced.completedMessage;
    completedPayout = advanced.completedPayout;
  }

  const cars = listTaxiCarOptions(player, now);
  const selected = state?.carSelected
    ? cars.find((c) => c.source === state.carSource && c.refId === state.carRefId)
    : undefined;

  let activeTrip: TaxiActiveTripView | null = null;
  if (state?.activeTrip) {
    activeTrip = {
      orderId: state.activeTrip.orderId,
      startedAt: state.activeTrip.startedAt,
      endsAt: state.activeTrip.endsAt,
      remainingMs: Math.max(0, state.activeTrip.endsAt - now),
      order: state.activeTrip.order,
    };
  }

  const carTariff = state?.taxiClass ?? "economy";
  const rawOrders = state?.activeTrip ? [] : (state?.availableOrders ?? []);
  const availableOrders: TaxiOrderView[] = rawOrders.map((o) => {
    const canAccept = canCarFulfillOrderTariff(carTariff, o.tariff);
    const block = acceptBlockReasonForOrder(carTariff, o.tariff);
    return {
      ...o,
      canAccept,
      acceptBlockReason: block,
    };
  });

  const carTariffDef = taxiConfig.tariffs[carTariff];

  return {
    carSelected: Boolean(selected),
    onLine: state?.onLine ?? false,
    rating: state?.rating ?? taxiConfig.ratingDefault,
    sessionIncomeRub: state?.sessionIncomeRub ?? 0,
    ordersCompleted: state?.ordersCompleted ?? 0,
    ordersDeclined: state?.ordersDeclined ?? 0,
    carLabel: selected?.label ?? null,
    taxiClass: state?.taxiClass ?? null,
    taxiClassTitle: carTariffDef?.title ?? null,
    selectedCarKey: selected ? carKey(selected) : null,
    availableOrders,
    activeTrip,
    ordersRefreshAt: state?.ordersRefreshAt ?? 0,
    ordersRefreshInMs: state ? Math.max(0, state.ordersRefreshAt - now) : 0,
    targetIncomeRub: job.taxiTargetIncomeRub ?? job.payoutMax ?? 10_000,
    payoutMin: job.payoutMin ?? 0,
    payoutMax: job.payoutMax ?? 0,
    availableCars: cars,
    cityTariffs: availableTariffsForCity(player.city_id),
    completedMessage,
    completedPayout,
  };
}

export function taxiClearCar(
  player: PlayerRow,
): { ok: true; message: string } | { ok: false; error: string } {
  const state = parseTaxiState(player);
  if (state?.onLine) return { ok: false, error: "Сначала завершите линию" };
  if (state?.activeTrip) return { ok: false, error: "Дождитесь окончания поездки" };
  saveTaxiState(player.user_id, null);
  return { ok: true, message: "Выбор автомобиля сброшен" };
}

export function taxiSelectCar(
  player: PlayerRow,
  carSource: "owned" | "rental",
  carRefId: number,
  now = Date.now(),
): { ok: true; message: string } | { ok: false; error: string } {
  if (carSource === "rental" && !isVehicleRentalActive(player, now)) {
    return { ok: false, error: "Аренда истекла — выберите свой автомобиль или оформите новую аренду" };
  }
  const options = listTaxiCarOptions(player, now);
  const car = options.find((c) => c.source === carSource && c.refId === carRefId);
  if (!car) return { ok: false, error: "Автомобиль не найден" };
  if (!tariffAllowedInCity(player.city_id, car.taxiClass)) {
    return { ok: false, error: "Этот класс авто недоступен для тарифов в вашем городе" };
  }

  const prev = parseTaxiState(player);
  const state: TaxiState = {
    onLine: false,
    rating: prev?.rating ?? taxiConfig.ratingDefault,
    carSource,
    carRefId,
    carModelId: car.modelId,
    taxiClass: car.taxiClass,
    carSelected: true,
    availableOrders: [],
    ordersRefreshAt: 0,
    activeTrip: prev?.activeTrip ?? null,
    lastActivityAt: now,
    sessionIncomeRub: prev?.sessionIncomeRub ?? 0,
    ordersCompleted: prev?.ordersCompleted ?? 0,
    ordersDeclined: prev?.ordersDeclined ?? 0,
  };
  saveTaxiState(player.user_id, state);
  const refreshed = getPlayer(player.user_id) ?? player;
  const saved = parseTaxiState(refreshed);
  const stillAvailable = listTaxiCarOptions(refreshed, now).some(
    (c) => c.source === carSource && c.refId === carRefId,
  );
  if (!saved?.carSelected || !stillAvailable) {
    saveTaxiState(player.user_id, null);
    return {
      ok: false,
      error: "Этот автомобиль недоступен для такси (аренда истекла или не подходит)",
    };
  }
  return { ok: true, message: `Выбран автомобиль: ${car.label} (${car.tariffTitle})` };
}

export function taxiGoOnline(
  player: PlayerRow,
  now = Date.now(),
): { ok: true; message: string } | { ok: false; error: string } {
  if (player.sleep_started_at != null) {
    return { ok: false, error: "Вы спите — сначала проснитесь" };
  }

  let state = parseTaxiState(player);
  if (!state?.carSelected) {
    return { ok: false, error: "Сначала выберите автомобиль" };
  }
  const cars = listTaxiCarOptions(player, now);
  const selectedCar = cars.find((c) => c.source === state!.carSource && c.refId === state!.carRefId);
  if (!selectedCar) {
    if (!state.activeTrip) saveTaxiState(player.user_id, null);
    return { ok: false, error: "Аренда или автомобиль недоступны — выберите другое авто" };
  }
  if (state.activeTrip) {
    return { ok: false, error: "Дождитесь окончания текущей поездки" };
  }
  if (state.onLine) return { ok: false, error: "Вы уже на линии" };

  let onLineState: TaxiState = {
    ...state,
    onLine: true,
    lastActivityAt: now,
    availableOrders: [],
    ordersRefreshAt: 0,
  };
  onLineState = refreshOrderPool(player, onLineState, now);
  saveTaxiState(player.user_id, onLineState);
  const car = cars.find((c) => c.source === onLineState.carSource && c.refId === onLineState.carRefId);
  appendPlayerFeed(player.user_id, "work:taxi", `На линии (${car?.label ?? "авто"})`, now);
  return { ok: true, message: `Работа на линии: ${car?.label ?? "авто"}` };
}

export function taxiGoOffline(
  player: PlayerRow,
  now = Date.now(),
): { ok: true; message: string; sessionIncomeRub: number } | { ok: false; error: string } {
  const state = parseTaxiState(player);
  if (!state?.onLine && !state?.carSelected) {
    return { ok: false, error: "Вы не на линии" };
  }
  if (state.activeTrip) {
    return { ok: false, error: "Завершите поездку перед уходом с линии" };
  }
  const income = state.sessionIncomeRub;
  const kept: TaxiState = {
    ...state,
    onLine: false,
    availableOrders: [],
    ordersRefreshAt: 0,
    lastActivityAt: now,
  };
  saveTaxiState(player.user_id, kept.carSelected ? kept : null);
  appendPlayerFeed(
    player.user_id,
    "work:taxi",
    `Завершили линию (+${income.toLocaleString("ru-RU")} ₽ за сессию)`,
    now,
  );
  return {
    ok: true,
    message: `Линия завершена. За сессию: ${income.toLocaleString("ru-RU")} ₽`,
    sessionIncomeRub: income,
  };
}

export function taxiAcceptOrder(
  player: PlayerRow,
  job: JobDef,
  orderId: string,
  now = Date.now(),
): { ok: true; message: string } | { ok: false; error: string } {
  let state = parseTaxiState(player);
  if (!state?.onLine) return { ok: false, error: "Сначала выйдите на линию" };
  if (state.activeTrip) return { ok: false, error: "Вы уже в поездке" };

  const order = state.availableOrders.find((o) => o.id === orderId);
  if (!order) return { ok: false, error: "Заказ не найден или устарел" };

  if (!canCarFulfillOrderTariff(state.taxiClass, order.tariff)) {
    const block = acceptBlockReasonForOrder(state.taxiClass, order.tariff);
    return { ok: false, error: block ?? "Автомобиль не подходит для этого тарифа" };
  }

  const tripMs = order.tripMinutes * MS_MIN;
  const activeTrip: TaxiActiveTrip = {
    orderId: order.id,
    startedAt: now,
    endsAt: now + tripMs,
    order,
  };

  state = {
    ...state,
    activeTrip,
    availableOrders: state.availableOrders.filter((o) => o.id !== orderId),
    lastActivityAt: now,
  };
  saveTaxiState(player.user_id, state);

  return {
    ok: true,
    message: `В пути ${order.tripMinutes} мин · тариф «${order.tariffTitle}». Выплата по прибытии: ${order.payoutRub.toLocaleString("ru-RU")} ₽`,
  };
}

export function taxiDeclineOrder(
  player: PlayerRow,
  orderId: string,
  now = Date.now(),
): { ok: true; message: string } | { ok: false; error: string } {
  let state = parseTaxiState(player);
  if (!state?.onLine) return { ok: false, error: "Вы не на линии" };
  if (state.activeTrip) return { ok: false, error: "Вы в поездке" };

  const had = state.availableOrders.some((o) => o.id === orderId);
  if (!had) return { ok: false, error: "Заказ не найден" };

  state = {
    ...state,
    availableOrders: state.availableOrders.filter((o) => o.id !== orderId),
    ordersDeclined: state.ordersDeclined + 1,
    rating: clampRating(state.rating - taxiConfig.ratingDeclinePenalty),
    lastActivityAt: now,
  };
  saveTaxiState(player.user_id, state);

  return { ok: true, message: "Заказ отклонён" };
}

export function syncTaxiForPlayer(player: PlayerRow, now = Date.now()): void {
  const state = parseTaxiState(player);
  if (!state) return;
  const job = getTaxiJobForPlayer(player);
  advanceTaxiState(player, job, state, now);
}

export function taxiBlocksShift(player: PlayerRow): boolean {
  return taxiBlocksWork(player);
}

export function refreshTaxiAfterWork(player: PlayerRow, now = Date.now()): PlayerRow {
  syncTaxiForPlayer(player, now);
  return getPlayer(player.user_id) ?? player;
}

export function getTaxiJobForPlayer(player: PlayerRow): JobDef | undefined {
  if (!player.job_id) return undefined;
  const cityId = jobCityId(player.job_id);
  if (!cityId) return undefined;
  return findCityJob(cityId, player.job_id);
}

export function playerMeetsCarRequirement(player: PlayerRow, now = Date.now()): boolean {
  if (playerHasAnyCar(player.user_id)) return true;
  return isVehicleRentalActive(player, now);
}
