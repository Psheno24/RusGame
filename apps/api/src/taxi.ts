import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PlayerRow } from "./db.js";
import { getPlayer, updatePlayer } from "./db.js";
import { applyWorkStatCosts } from "./actions.js";
import { appendPlayerFeed } from "./playerFeed.js";
import { DATA_DIR } from "./config.js";
import { randInt } from "./random.js";
import { findCityJob, getCar, getVehicleRental, type JobDef } from "./gameData.js";
import { getCitySalaryMultiplier, skillPayoutMultiplier } from "./jobSalaries.js";
import { listPlayerCars, playerHasAnyCar } from "./playerCars.js";
import {
  isTaxiOnLine,
  parseTaxiState,
  saveTaxiState,
  type TaxiOrder,
  type TaxiState,
} from "./playerTaxi.js";
import { canAffordCosts, clampVital, scaleWorkCosts } from "./playerStats.js";
import { jobCityId } from "./jobLocation.js";

type TaxiConfig = {
  idleOfflineMs: number;
  orderWaitMsMin: number;
  orderWaitMsMax: number;
  ratingDefault: number;
  ratingMin: number;
  ratingMax: number;
  ratingDeclinePenalty: number;
  ratingIgnorePenalty: number;
  ratingGoodTripBonus: number;
  ratingBadTripPenalty: number;
  cashPartialPayChance: number;
  cashNoPayChance: number;
  cashPartialPayFraction: number;
  parkCompensationFraction: number;
  energyPerOrderBase: number;
  energyConflictExtra: number;
  energyLongTripExtra: number;
  longTripMinutes: number;
  tariffs: Record<string, { title: string; orderMult: number; minCityMultiplier: number }>;
  carClassByPrice: { maxPriceRub: number | null; class: string }[];
  cityTariffs: Record<string, string[]>;
  orderBaseRubOmsk: number;
};

const taxiConfig = JSON.parse(
  readFileSync(join(DATA_DIR, "taxiConfig.json"), "utf-8"),
) as TaxiConfig;

function clampRating(r: number): number {
  return Math.max(taxiConfig.ratingMin, Math.min(taxiConfig.ratingMax, Math.round(r * 100) / 100));
}

export function taxiCarClassForModel(carModelId: string): string {
  const car = getCar(carModelId);
  const price = car?.priceRub ?? 0;
  for (const row of taxiConfig.carClassByPrice) {
    if (row.maxPriceRub == null || price <= row.maxPriceRub) return row.class;
  }
  return "economy";
}

export function availableTariffsForCity(cityId: string): string[] {
  return taxiConfig.cityTariffs[cityId] ?? taxiConfig.cityTariffs.omsk ?? ["economy", "comfort"];
}

function tariffAllowedInCity(cityId: string, taxiClass: string): boolean {
  const list = availableTariffsForCity(cityId);
  const idx = list.indexOf(taxiClass);
  if (idx >= 0) return true;
  const order = ["economy", "comfort", "comfort_plus", "business"];
  const maxIdx = Math.max(...list.map((t) => order.indexOf(t)));
  return order.indexOf(taxiClass) <= maxIdx;
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
  if (
    player.vehicle_rental_id &&
    player.vehicle_rental_expires_at != null &&
    player.vehicle_rental_expires_at > now
  ) {
    const rental = getVehicleRental(player.vehicle_rental_id);
    const modelId = "lada-granta";
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

function syncIdleOffline(state: TaxiState, now: number): TaxiState {
  if (!state.onLine) return state;
  if (now - state.lastActivityAt >= taxiConfig.idleOfflineMs) {
    return { ...state, onLine: false, currentOrder: null };
  }
  return state;
}

function generateOrder(player: PlayerRow, state: TaxiState): TaxiOrder {
  const cityMult = getCitySalaryMultiplier(player.city_id);
  const tariffDef = taxiConfig.tariffs[state.taxiClass] ?? taxiConfig.tariffs.economy!;
  const ratingMult = 0.88 + ((state.rating - taxiConfig.ratingMin) / (taxiConfig.ratingMax - taxiConfig.ratingMin)) * 0.22;
  const tripMinutes = randInt(6, 38);
  const passengerRating =
    Math.random() < 0.65
      ? randInt(42, 50) / 10
      : Math.random() < 0.5
        ? randInt(35, 41) / 10
        : randInt(30, 34) / 10;
  const payment: "card" | "cash" = Math.random() < 0.38 ? "cash" : "card";
  const tripFactor = 0.75 + tripMinutes / 40;
  const variance = 0.85 + Math.random() * 0.35;
  const expectedPayoutRub = Math.max(
    150,
    Math.round(
      taxiConfig.orderBaseRubOmsk *
        cityMult *
        tariffDef.orderMult *
        ratingMult *
        tripFactor *
        variance,
    ),
  );
  return {
    id: `o-${Date.now()}-${randInt(1000, 9999)}`,
    tripMinutes,
    passengerRating,
    payment,
    expectedPayoutRub,
    tariff: state.taxiClass,
    tariffTitle: tariffDef.title,
    offeredAt: Date.now(),
  };
}

function ensureOrder(player: PlayerRow, state: TaxiState, now: number): TaxiState {
  if (!state.onLine || state.currentOrder) return state;
  const waitMs =
    state.lastOrderOfferAt > 0
      ? randInt(taxiConfig.orderWaitMsMin, taxiConfig.orderWaitMsMax)
      : 0;
  if (state.lastOrderOfferAt > 0 && now - state.lastOrderOfferAt < waitMs) return state;
  const order = generateOrder(player, state);
  return {
    ...state,
    currentOrder: order,
    lastOrderOfferAt: now,
    lastActivityAt: now,
  };
}

export type TaxiStatus = {
  onLine: boolean;
  rating: number;
  sessionIncomeRub: number;
  ordersCompleted: number;
  ordersDeclined: number;
  carLabel: string | null;
  taxiClass: string | null;
  currentOrder: TaxiOrder | null;
  targetIncomeRub: number;
  payoutMin: number;
  payoutMax: number;
  availableCars: TaxiCarOption[];
  cityTariffs: string[];
};

export function getTaxiStatus(player: PlayerRow, job: JobDef, now = Date.now()): TaxiStatus {
  let state = parseTaxiState(player);
  if (state) {
    state = syncIdleOffline(state, now);
    state = ensureOrder(player, state, now);
    saveTaxiState(player.user_id, state);
  }
  const car = state
    ? listTaxiCarOptions(player, now).find(
        (c) => c.source === state!.carSource && c.refId === state!.carRefId,
      )
    : null;
  return {
    onLine: state?.onLine ?? false,
    rating: state?.rating ?? taxiConfig.ratingDefault,
    sessionIncomeRub: state?.sessionIncomeRub ?? 0,
    ordersCompleted: state?.ordersCompleted ?? 0,
    ordersDeclined: state?.ordersDeclined ?? 0,
    carLabel: car?.label ?? null,
    taxiClass: state?.taxiClass ?? null,
    currentOrder: state?.currentOrder ?? null,
    targetIncomeRub: job.taxiTargetIncomeRub ?? job.payoutMax ?? 10_000,
    payoutMin: job.payoutMin ?? 0,
    payoutMax: job.payoutMax ?? 0,
    availableCars: listTaxiCarOptions(player, now),
    cityTariffs: availableTariffsForCity(player.city_id),
  };
}

export function taxiGoOnline(
  player: PlayerRow,
  carSource: "owned" | "rental",
  carRefId: number,
  now = Date.now(),
): { ok: true; message: string } | { ok: false; error: string } {
  const options = listTaxiCarOptions(player, now);
  const car = options.find((c) => c.source === carSource && c.refId === carRefId);
  if (!car) return { ok: false, error: "Автомобиль не найден" };
  if (!tariffAllowedInCity(player.city_id, car.taxiClass)) {
    return { ok: false, error: "Этот класс авто недоступен для тарифов в вашем городе" };
  }
  const prev = parseTaxiState(player);
  const state: TaxiState = {
    onLine: true,
    rating: prev?.rating ?? taxiConfig.ratingDefault,
    carSource,
    carRefId,
    carModelId: car.modelId,
    taxiClass: car.taxiClass,
    currentOrder: null,
    lastActivityAt: now,
    sessionIncomeRub: 0,
    ordersCompleted: 0,
    ordersDeclined: 0,
    lastOrderOfferAt: 0,
  };
  saveTaxiState(player.user_id, state);
  appendPlayerFeed(player.user_id, "work:taxi", `Вышли на линию (${car.label})`, now);
  return { ok: true, message: `На линии: ${car.label}, тариф «${car.tariffTitle}»` };
}

export function taxiGoOffline(
  player: PlayerRow,
  now = Date.now(),
): { ok: true; message: string; sessionIncomeRub: number } | { ok: false; error: string } {
  const state = parseTaxiState(player);
  if (!state?.onLine) return { ok: false, error: "Вы не на линии" };
  const income = state.sessionIncomeRub;
  saveTaxiState(player.user_id, null);
  appendPlayerFeed(
    player.user_id,
    "work:taxi",
    `Сошли с линии (+${income.toLocaleString("ru-RU")} ₽ за сессию)`,
    now,
  );
  return {
    ok: true,
    message: `С линии. Заработано за сессию: ${income.toLocaleString("ru-RU")} ₽`,
    sessionIncomeRub: income,
  };
}

type TripResult = {
  payoutRub: number;
  message: string;
  moodDelta: number;
  energyCost: number;
};

function resolveTrip(
  player: PlayerRow,
  job: JobDef,
  state: TaxiState,
  order: TaxiOrder,
): TripResult {
  const skillMult = skillPayoutMultiplier(player, "taxi");
  let payoutRub = Math.floor(order.expectedPayoutRub * skillMult);
  let moodDelta = 0;
  let energyCost = taxiConfig.energyPerOrderBase;

  if (order.passengerRating >= 4.5) moodDelta += randInt(0, 2);
  else if (order.passengerRating < 3.5) moodDelta -= randInt(1, 3);

  if (order.tripMinutes >= taxiConfig.longTripMinutes) energyCost += taxiConfig.energyLongTripExtra;
  if (order.passengerRating < 3.5) energyCost += taxiConfig.energyConflictExtra;

  let payNote = "";
  if (order.payment === "cash" && order.passengerRating < 4) {
    if (Math.random() < taxiConfig.cashNoPayChance) {
      payoutRub = Math.floor(payoutRub * taxiConfig.parkCompensationFraction);
      payNote = " Пассажир не заплатил — таксопарк компенсировал часть.";
      moodDelta -= 2;
    } else if (Math.random() < taxiConfig.cashPartialPayChance) {
      payoutRub = Math.floor(payoutRub * taxiConfig.cashPartialPayFraction);
      payNote = " Неполная оплата наличными.";
      moodDelta -= 1;
    }
  }

  const reviewRoll = Math.random();
  if (order.passengerRating >= 4.5 && reviewRoll < 0.35) {
    state.rating = clampRating(state.rating + taxiConfig.ratingGoodTripBonus);
  } else if (order.passengerRating < 3.5 && reviewRoll < 0.4) {
    state.rating = clampRating(state.rating - taxiConfig.ratingBadTripPenalty);
  }

  const msg = `${order.tariffTitle}, ${order.tripMinutes} мин · +${payoutRub.toLocaleString("ru-RU")} ₽${payNote}`;
  return { payoutRub, message: msg, moodDelta, energyCost };
}

export function taxiAcceptOrder(
  player: PlayerRow,
  job: JobDef,
  now = Date.now(),
): { ok: true; message: string; payout: number } | { ok: false; error: string } {
  let state = parseTaxiState(player);
  if (!state?.onLine) return { ok: false, error: "Сначала выйдите на линию" };
  state = syncIdleOffline(state, now);
  if (!state.onLine) return { ok: false, error: "Вы автоматически сошли с линии из‑за бездействия" };
  if (!state.currentOrder) return { ok: false, error: "Нет активного заказа" };

  const costs = scaleWorkCosts(player, {
    energy: taxiConfig.energyPerOrderBase,
    hunger: job.workCosts?.hunger ?? 4,
    mood: 0,
  });
  const lifeErr = canAffordCosts(player, costs);
  if (lifeErr) return { ok: false, error: lifeErr };

  const order = state.currentOrder;
  const trip = resolveTrip(player, job, state, order);
  const scaledCosts = scaleWorkCosts(player, {
    ...costs,
    energy: trip.energyCost,
  });
  const statPatch = applyWorkStatCosts(player, scaledCosts);

  state.sessionIncomeRub += trip.payoutRub;
  state.ordersCompleted += 1;
  state.currentOrder = null;
  state.lastActivityAt = now;
  state.lastOrderOfferAt = now;
  state.rating = clampRating(state.rating);

  saveTaxiState(player.user_id, state);

  const mood = clampVital("mood", (statPatch.mood ?? player.mood ?? 70) + trip.moodDelta);
  const witGain = Math.random() < 0.4 ? 1 : 0;
  updatePlayer(player.user_id, {
    ...statPatch,
    mood,
    rubles: player.rubles + trip.payoutRub,
    wit: player.wit + witGain,
  });

  appendPlayerFeed(player.user_id, "work:taxi", `Заказ: ${trip.message}`, now);
  return { ok: true, message: trip.message, payout: trip.payoutRub };
}

export function taxiDeclineOrder(
  player: PlayerRow,
  now = Date.now(),
): { ok: true; message: string } | { ok: false; error: string } {
  let state = parseTaxiState(player);
  if (!state?.onLine) return { ok: false, error: "Вы не на линии" };
  if (!state.currentOrder) return { ok: false, error: "Нет заказа" };

  state.ordersDeclined += 1;
  state.rating = clampRating(state.rating - taxiConfig.ratingDeclinePenalty);
  state.currentOrder = null;
  state.lastActivityAt = now;
  state.lastOrderOfferAt = now;
  saveTaxiState(player.user_id, state);

  return { ok: true, message: "Заказ отклонён. Рейтинг слегка снизился." };
}

export function syncTaxiForPlayer(player: PlayerRow, now = Date.now()): void {
  const state = parseTaxiState(player);
  if (!state?.onLine) return;
  const synced = syncIdleOffline(ensureOrder(player, state, now), now);
  if (JSON.stringify(synced) !== JSON.stringify(state)) {
    saveTaxiState(player.user_id, synced.onLine ? synced : null);
  }
}

export function taxiBlocksShift(player: PlayerRow): boolean {
  return isTaxiOnLine(player);
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
  return Boolean(
    player.vehicle_rental_id &&
      player.vehicle_rental_expires_at != null &&
      player.vehicle_rental_expires_at > now,
  );
}
