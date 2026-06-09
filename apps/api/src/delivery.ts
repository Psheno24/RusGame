import { formatRub } from "./formatRub.js";
import type { PlayerRow } from "./db.js";
import { getPlayer, updatePlayer } from "./db.js";
import { appendPlayerFeed } from "./playerFeed.js";
import { getBalanceBible, getCityEconomyMultiplier, scaledWorkEnergyCost } from "./balanceBible.js";
import { randInt } from "./random.js";
import type { JobDef } from "./gameData.js";
import { skillPayoutMultiplier } from "./jobSalaries.js";
import { effectiveMood } from "./housingMood.js";
import { recordSkillActionForTemplate, SKILL_LABELS } from "./skills.js";
import {
  clampReputation,
  clampVital,
  scaleWorkCosts,
} from "./playerStats.js";
import { validateJobWorkAccess } from "./jobLocation.js";
import { isVehicleRentalActive } from "./vehicleRental.js";
import { listPlayerCars, playerHasAnyCar } from "./playerCars.js";
import { applyDrivingWear } from "./carWear.js";
import { consumeFuelLiters } from "./carFuel.js";
import {
  hasActiveDeliveryTrip,
  parseDeliveryState,
  saveDeliveryState,
  type DeliveryActiveTrip,
  type DeliveryModifier,
  type DeliveryOrder,
  type DeliveryState,
  type DeliveryTransport,
} from "./playerDelivery.js";

const MODIFIER_TITLES: Record<DeliveryModifier, string> = {
  short: "Короткий",
  normal: "Обычный",
  urgent: "Срочный",
  heavy: "Тяжёлый",
  night: "Ночной",
};

function detectTransport(player: PlayerRow, now: number): DeliveryTransport {
  if (playerHasAnyCar(player.user_id)) return "car";
  const rental = player.vehicle_rental_id;
  if (rental && isVehicleRentalActive(player, now)) {
    if (rental === "bike") return "bike";
    if (rental === "scooter") return "scooter";
    if (rental === "moped") return "moped";
    if (rental.startsWith("car")) return "car";
  }
  return "walk";
}

function pickModifier(): DeliveryModifier {
  const bible = getBalanceBible().delivery as {
    modifierWeights: Record<DeliveryModifier, number>;
    modifiers: Record<DeliveryModifier, number>;
  };
  const entries = Object.entries(bible.modifierWeights) as [DeliveryModifier, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r <= 0) return key;
  }
  return "normal";
}

function generateOrder(player: PlayerRow, now: number): DeliveryOrder {
  const bible = getBalanceBible().delivery as {
    transport: Record<
      DeliveryTransport,
      { ratePerKm: number; minKm: number; maxKm: number; minPerKm: number }
    >;
    modifiers: Record<DeliveryModifier, number>;
  };
  const transport = detectTransport(player, now);
  const cfg = bible.transport[transport];
  const distanceKm = randInt(cfg.minKm * 10, cfg.maxKm * 10) / 10;
  const modifier = pickModifier();
  const modMult = bible.modifiers[modifier] ?? 1;
  const cityMult = getCityEconomyMultiplier(player.city_id);
  const skillMult = skillPayoutMultiplier(player, "delivery");
  const basePayoutRub = Math.max(
    100,
    Math.round(distanceKm * cfg.ratePerKm * modMult * cityMult * skillMult),
  );
  const tripMinutes = Math.max(1, Math.round(distanceKm * cfg.minPerKm));

  return {
    id: `d-${Date.now()}-${randInt(1000, 9999)}`,
    distanceKm,
    transport,
    modifier,
    modifierTitle: MODIFIER_TITLES[modifier],
    basePayoutRub,
    tripMinutes,
    offeredAt: now,
  };
}

function rollEvents(basePayout: number): {
  payoutRub: number;
  extraMinutes: number;
  reputationDelta: number;
  notes: string[];
} {
  const events = getBalanceBible().delivery.events as Record<
    string,
    {
      chance: number;
      bonusMin?: number;
      bonusMax?: number;
      payMult?: number;
      extraMinMin?: number;
      extraMinMax?: number;
      reputationDelta?: number;
    }
  >;
  let payoutRub = basePayout;
  let extraMinutes = 0;
  let reputationDelta = 0;
  const notes: string[] = [];

  if (Math.random() < events.tips.chance) {
    const tip = randInt(events.tips.bonusMin!, events.tips.bonusMax!);
    payoutRub += tip;
    notes.push(`+${formatRub(tip)} чаевые`);
  }
  if (Math.random() < events.regularClient.chance) {
    payoutRub = Math.round(payoutRub * events.regularClient.payMult!);
    notes.push("Постоянный клиент ×1.5");
  }
  if (Math.random() < events.fastDelivery.chance) {
    payoutRub = Math.round(payoutRub * events.fastDelivery.payMult!);
    notes.push("Быстрая доставка +25%");
  }
  if (Math.random() < events.restaurantDelay.chance) {
    extraMinutes += randInt(events.restaurantDelay.extraMinMin!, events.restaurantDelay.extraMinMax!);
    notes.push("Ресторан долго готовил");
  }
  if (Math.random() < events.clientDelay.chance) {
    extraMinutes += randInt(events.clientDelay.extraMinMin!, events.clientDelay.extraMinMax!);
    notes.push("Клиент долго открывал");
  }
  if (Math.random() < events.damagedPackaging.chance) {
    payoutRub = Math.round(payoutRub * events.damagedPackaging.payMult!);
    notes.push("Испорчена упаковка −20%");
  }
  if (Math.random() < events.complaint.chance) {
    payoutRub = Math.round(payoutRub * events.complaint.payMult!);
    reputationDelta += events.complaint.reputationDelta ?? 0;
    notes.push("Жалоба −50%");
  }
  if (Math.random() < events.cancel.chance) {
    payoutRub = Math.round(payoutRub * events.cancel.payMult!);
    notes.push("Отмена (30% оплаты)");
  }

  return { payoutRub, extraMinutes, reputationDelta, notes };
}

function completeTrip(
  player: PlayerRow,
  state: DeliveryState,
  now: number,
): { state: DeliveryState; payoutRub: number; message: string } {
  const trip = state.activeTrip!;
  const rolled = rollEvents(trip.order.basePayoutRub);
  const totalMinutes = trip.order.tripMinutes + rolled.extraMinutes;

  const energyCost = scaleWorkCosts(player, {
    energy: scaledWorkEnergyCost("delivery", effectiveMood(player)),
  })?.energy ?? 2;

  if (trip.order.transport === "car") {
    const carRow = listPlayerCars(player.user_id)[0];
    if (carRow) {
      applyDrivingWear(player.user_id, carRow.id, trip.order.distanceKm);
      consumeFuelLiters(player.user_id, carRow.id, trip.order.distanceKm);
    }
  }

  const skillResult = recordSkillActionForTemplate(player, "delivery");
  const patch: Partial<PlayerRow> = {
    rubles: player.rubles + rolled.payoutRub,
    energy: clampVital("energy", (player.energy ?? 80) - energyCost),
    reputation: clampReputation((player.reputation ?? 0) + 2 + rolled.reputationDelta),
    mood: clampVital("mood", (player.mood ?? 0) + getBalanceBible().mood.sideJobPenalty),
    ...skillResult.patch,
  };
  updatePlayer(player.user_id, patch);

  if (skillResult.granted) {
    appendPlayerFeed(
      player.user_id,
      "work:delivery",
      `Навык: +${skillResult.granted.amount} ${SKILL_LABELS[skillResult.granted.key]}`,
      now,
    );
  }

  const noteStr = rolled.notes.length ? ` · ${rolled.notes.join(", ")}` : "";
  const msg = `Доставка ${trip.order.distanceKm} км · ${totalMinutes} мин · +${formatRub(rolled.payoutRub)}${noteStr}`;

  return {
    state: {
      ...state,
      activeTrip: null,
      sessionIncomeRub: state.sessionIncomeRub + rolled.payoutRub,
      ordersCompleted: state.ordersCompleted + 1,
      lastActivityAt: now,
    },
    payoutRub: rolled.payoutRub,
    message: msg,
  };
}

function advanceState(
  player: PlayerRow,
  state: DeliveryState,
  now: number,
): { state: DeliveryState; completedMessage?: string; completedPayout?: number } {
  if (state.activeTrip && state.activeTrip.endsAt <= now) {
    const done = completeTrip(player, state, now);
    saveDeliveryState(player.user_id, done.state);
    return {
      state: done.state,
      completedMessage: done.message,
      completedPayout: done.payoutRub,
    };
  }
  return { state };
}

export type DeliveryStatus = {
  transport: DeliveryTransport;
  activeTrip: (DeliveryActiveTrip & { remainingMs: number }) | null;
  sessionIncomeRub: number;
  ordersCompleted: number;
  canTakeOrder: boolean;
  takeOrderBlockedReason?: string | null;
  completedMessage?: string;
  completedPayout?: number;
};

export function getDeliveryStatus(player: PlayerRow, job: JobDef, now = Date.now()): DeliveryStatus {
  let state = parseDeliveryState(player) ?? {
    activeTrip: null,
    sessionIncomeRub: 0,
    ordersCompleted: 0,
    lastActivityAt: now,
  };

  const advanced = advanceState(player, state, now);
  state = advanced.state;

  const transport = detectTransport(player, now);
  let activeTrip: DeliveryStatus["activeTrip"] = null;
  if (state.activeTrip) {
    activeTrip = {
      ...state.activeTrip,
      remainingMs: Math.max(0, state.activeTrip.endsAt - now),
    };
  }

  const accessError = validateJobWorkAccess(player, job.id, now);
  const energyCost = scaleWorkCosts(player, { energy: 2 })?.energy ?? 2;
  let takeOrderBlockedReason: string | null = null;
  if (accessError) takeOrderBlockedReason = accessError;
  else if (state.activeTrip) takeOrderBlockedReason = "Сначала завершите текущую доставку";
  else if ((player.energy ?? 0) < energyCost) {
    takeOrderBlockedReason = "Недостаточно энергии для заказа";
  }
  const canTakeOrder = takeOrderBlockedReason == null;

  return {
    transport,
    activeTrip,
    sessionIncomeRub: state.sessionIncomeRub,
    ordersCompleted: state.ordersCompleted,
    canTakeOrder,
    takeOrderBlockedReason,
    completedMessage: advanced.completedMessage,
    completedPayout: advanced.completedPayout,
  };
}

export function deliveryTakeOrder(
  player: PlayerRow,
  job: JobDef,
  now = Date.now(),
): { ok: true; message: string; order: DeliveryOrder } | { ok: false; error: string } {
  if (player.sleep_started_at != null) {
    return { ok: false, error: "Вы спите — сначала проснитесь" };
  }
  const accessError = validateJobWorkAccess(player, job.id, now);
  if (accessError) return { ok: false, error: accessError };

  let state = parseDeliveryState(player) ?? {
    activeTrip: null,
    sessionIncomeRub: 0,
    ordersCompleted: 0,
    lastActivityAt: now,
  };

  const advanced = advanceState(player, state, now);
  state = advanced.state;
  if (state.activeTrip) {
    return { ok: false, error: "Сначала завершите текущую доставку" };
  }

  const energyCost = scaleWorkCosts(player, { energy: 2 })?.energy ?? 2;
  if ((player.energy ?? 0) < energyCost) {
    return { ok: false, error: "Недостаточно энергии для заказа" };
  }

  const order = generateOrder(player, now);
  const tripMs = order.tripMinutes * 60_000;
  state = {
    ...state,
    activeTrip: {
      orderId: order.id,
      startedAt: now,
      endsAt: now + tripMs,
      order,
    },
    lastActivityAt: now,
  };
  saveDeliveryState(player.user_id, state);

  return {
    ok: true,
    message: `Заказ: ${order.distanceKm} км · ${order.modifierTitle} · ~${formatRub(order.basePayoutRub)}`,
    order,
  };
}

export function deliveryBlocksShift(player: PlayerRow): boolean {
  return hasActiveDeliveryTrip(player);
}

export function clearDeliveryState(userId: number) {
  saveDeliveryState(userId, null);
}
