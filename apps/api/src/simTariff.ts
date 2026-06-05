import { formatRub } from "./formatRub.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./config.js";
import { getCityLocalTime, getCityTimezone } from "./cityTime.js";
import { getCity } from "./gameData.js";
import { getPlayer, updatePlayer, type PlayerRow } from "./db.js";
import { formatLocaleDateRu } from "./formatLocaleDate.js";
import { playerHasSim } from "./simNumber.js";

export type SimTariffId = "incoming_only" | "minimal" | "connected" | "unlimited";

export type SimTariffPlan = {
  id: SimTariffId;
  title: string;
  weeklyRubBase: number;
};

export type SimTariffChangeKind = "new" | "upgrade" | "downgrade";

type SimTariffsData = {
  weekMs: number;
  plans: SimTariffPlan[];
  priceMultiplierByTier: Record<string, number>;
};

const data = JSON.parse(readFileSync(join(DATA_DIR, "simTariffs.json"), "utf-8")) as SimTariffsData;

export const SIM_TARIFF_WEEK_MS = data.weekMs;
const DAY_MS = 86_400_000;

const TARIFF_RANK: Record<SimTariffId, number> = {
  incoming_only: 0,
  minimal: 1,
  connected: 2,
  unlimited: 3,
};

export const SIM_TARIFF_PLANS = data.plans;

export function getSimTariffPlan(id: string): SimTariffPlan | undefined {
  return data.plans.find((p) => p.id === id);
}

export function getPlayerSimTariffId(player: PlayerRow): SimTariffId {
  const id = player.sim_tariff_id ?? "incoming_only";
  return getSimTariffPlan(id) ? (id as SimTariffId) : "incoming_only";
}

export function getWeeklyTariffPrice(planId: SimTariffId, cityId: string): number {
  const plan = getSimTariffPlan(planId);
  if (!plan || plan.weeklyRubBase <= 0) return 0;
  const city = getCity(cityId);
  const tier = city?.tier ?? 2;
  const mult = data.priceMultiplierByTier[String(tier)] ?? 1;
  return Math.round(plan.weeklyRubBase * mult);
}

export function tariffChangeKind(
  currentId: SimTariffId,
  nextId: SimTariffId,
): SimTariffChangeKind {
  const cur = TARIFF_RANK[currentId];
  const next = TARIFF_RANK[nextId];
  if (next > cur) return "upgrade";
  if (next < cur) return "downgrade";
  return "new";
}

/** Days used in current paid week and days left until paidUntil. */
export function prorateTariffDays(
  paidUntil: number | null | undefined,
  now = Date.now(),
): { daysUsed: number; daysRemaining: number } {
  if (!paidUntil || paidUntil <= now) {
    return { daysUsed: 0, daysRemaining: 7 };
  }
  const periodStart = paidUntil - SIM_TARIFF_WEEK_MS;
  const usedMs = Math.max(0, Math.min(SIM_TARIFF_WEEK_MS, now - periodStart));
  const remainMs = Math.max(0, paidUntil - now);
  const daysUsed = Math.min(7, Math.max(0, Math.round(usedMs / DAY_MS)));
  let daysRemaining = Math.min(7, Math.max(0, Math.ceil(remainMs / DAY_MS)));
  if (daysUsed + daysRemaining > 7) daysRemaining = 7 - daysUsed;
  if (daysUsed + daysRemaining < 1 && remainMs > 0) daysRemaining = 1;
  return { daysUsed, daysRemaining };
}

/** Upgrade top-up: (new − current) × remaining days / 7. */
export function calcUpgradeTopUpRub(
  currentId: SimTariffId,
  nextId: SimTariffId,
  cityId: string,
  paidUntil: number | null | undefined,
  now = Date.now(),
): number {
  const { daysRemaining } = prorateTariffDays(paidUntil, now);
  if (daysRemaining <= 0) return getWeeklyTariffPrice(nextId, cityId);

  const currentWeekly = getWeeklyTariffPrice(currentId, cityId);
  const nextWeekly = getWeeklyTariffPrice(nextId, cityId);
  const diff = nextWeekly - currentWeekly;
  if (diff <= 0) return 0;
  return Math.max(0, Math.round((diff * daysRemaining) / 7));
}

export function playerMeetsSimTariff(player: PlayerRow, required: SimTariffId): boolean {
  if (!playerHasSim(player)) return false;
  return TARIFF_RANK[getPlayerSimTariffId(player)] >= TARIFF_RANK[required];
}

export function formatTariffPaidUntilLabel(
  tariffId: SimTariffId,
  paidUntil: number | null | undefined,
  timezone: string,
  now = Date.now(),
): string {
  if (tariffId === "incoming_only") return "бессрочно";
  if (!paidUntil || paidUntil <= now) return "—";
  return formatLocaleDateRu(paidUntil, { timeZone: timezone, withTime: true });
}

function applyPendingTariffAtBilling(
  player: PlayerRow,
  now: number,
): Partial<PlayerRow> | null {
  const pending = player.sim_tariff_pending_id;
  if (!pending || !getSimTariffPlan(pending)) return null;

  const pendingId = pending as SimTariffId;
  if (pendingId === "incoming_only") {
    return {
      sim_tariff_id: "incoming_only",
      sim_tariff_paid_until: null,
      sim_tariff_pending_id: null,
    };
  }

  const price = getWeeklyTariffPrice(pendingId, player.city_id);
  const balance = Math.floor(player.sim_balance_rub ?? 0);
  if (balance < price) {
    return {
      sim_tariff_id: "incoming_only",
      sim_tariff_paid_until: null,
      sim_tariff_pending_id: null,
    };
  }

  return {
    sim_tariff_id: pendingId,
    sim_tariff_paid_until: now + SIM_TARIFF_WEEK_MS,
    sim_tariff_pending_id: null,
    sim_balance_rub: balance - price,
  };
}

export function processSimTariffBilling(player: PlayerRow, now = Date.now()): Partial<PlayerRow> | null {
  const tariffId = getPlayerSimTariffId(player);
  const paidUntil = player.sim_tariff_paid_until ?? 0;

  if (tariffId !== "incoming_only" && paidUntil > 0 && paidUntil <= now) {
    const pendingPatch = applyPendingTariffAtBilling(player, now);
    if (pendingPatch) return pendingPatch;
  }

  if (tariffId === "incoming_only") return null;
  if (paidUntil > now) return null;

  const price = getWeeklyTariffPrice(tariffId, player.city_id);
  const balance = Math.floor(player.sim_balance_rub ?? 0);
  if (price > 0 && balance >= price) {
    return {
      sim_balance_rub: balance - price,
      sim_tariff_paid_until: now + SIM_TARIFF_WEEK_MS,
      sim_tariff_pending_id: null,
    };
  }

  return {
    sim_tariff_id: "incoming_only",
    sim_tariff_paid_until: null,
    sim_tariff_pending_id: null,
  };
}

export function syncPlayerSimTariffBilling(userId: number, now = Date.now()): PlayerRow | undefined {
  const player = getPlayer(userId);
  if (!player) return undefined;
  const patch = processSimTariffBilling(player, now);
  if (patch) {
    updatePlayer(userId, patch);
    return getPlayer(userId);
  }
  return player;
}

export function listTariffsForCity(cityId: string) {
  return data.plans.map((plan) => ({
    id: plan.id,
    title: plan.title,
    weeklyRub: getWeeklyTariffPrice(plan.id as SimTariffId, cityId),
    priceLabel:
      plan.weeklyRubBase <= 0
        ? formatRub(0)
        : `${formatRub(getWeeklyTariffPrice(plan.id as SimTariffId, cityId))}/нед`,
  }));
}

export type SimTariffQuote = {
  planId: SimTariffId;
  title: string;
  kind: SimTariffChangeKind;
  currentTitle: string;
  chargeRub: number;
  nextChargeAt: number | null;
  nextChargeLabel: string | null;
  effectiveAt: number | null;
  effectiveAtLabel: string | null;
  paidUntilLabel: string;
  cityName: string;
  weeklyRub: number;
  isCurrent: boolean;
  prorateDaysUsed: number | null;
  prorateDaysRemaining: number | null;
  currentWeeklyRub: number;
};

export function quoteSimTariff(player: PlayerRow, planId: string, now = Date.now()): SimTariffQuote | { error: string } {
  const plan = getSimTariffPlan(planId);
  if (!plan) return { error: "Тариф не найден" };
  if (!playerHasSim(player)) return { error: "Сначала оформите симку" };

  const id = plan.id as SimTariffId;
  const city = getCity(player.city_id);
  const timezone = getCityTimezone(city);
  const weeklyRub = getWeeklyTariffPrice(id, player.city_id);
  const currentId = getPlayerSimTariffId(player);
  const currentPlan = getSimTariffPlan(currentId)!;
  const kind = tariffChangeKind(currentId, id);

  if (id === currentId && !player.sim_tariff_pending_id) {
    return { error: "Этот тариф уже подключён" };
  }

  const balance = Math.floor(player.sim_balance_rub ?? 0);
  const paidUntil = player.sim_tariff_paid_until;
  const currentWeeklyRub = getWeeklyTariffPrice(currentId, player.city_id);

  if (kind === "downgrade") {
    const effectiveAt = currentId === "incoming_only" ? now : (paidUntil ?? now);
    return {
      planId: id,
      title: plan.title,
      kind,
      currentTitle: currentPlan.title,
      chargeRub: 0,
      nextChargeAt: id === "incoming_only" ? null : effectiveAt,
      nextChargeLabel:
        id === "incoming_only"
          ? null
          : formatTariffPaidUntilLabel(id, effectiveAt + SIM_TARIFF_WEEK_MS, timezone, now),
      effectiveAt,
      effectiveAtLabel: formatTariffPaidUntilLabel(currentId, effectiveAt, timezone, now),
      paidUntilLabel: formatTariffPaidUntilLabel(currentId, paidUntil, timezone, now),
      cityName: city?.name ?? player.city_id,
      weeklyRub,
      isCurrent: false,
      prorateDaysUsed: null,
      prorateDaysRemaining: null,
      currentWeeklyRub,
    };
  }

  if (kind === "upgrade" && currentId !== "incoming_only" && paidUntil && paidUntil > now) {
    const { daysUsed, daysRemaining } = prorateTariffDays(paidUntil, now);
    const chargeRub = calcUpgradeTopUpRub(currentId, id, player.city_id, paidUntil, now);
    if (chargeRub > balance) {
      return {
        error: `На балансе сим ${formatRub(balance)}, нужно ${formatRub(chargeRub)}`,
      };
    }
    return {
      planId: id,
      title: plan.title,
      kind,
      currentTitle: currentPlan.title,
      chargeRub,
      nextChargeAt: paidUntil,
      nextChargeLabel: formatTariffPaidUntilLabel(id, paidUntil, timezone, now),
      effectiveAt: now,
      effectiveAtLabel: null,
      paidUntilLabel: formatTariffPaidUntilLabel(id, paidUntil, timezone, now),
      cityName: city?.name ?? player.city_id,
      weeklyRub,
      isCurrent: false,
      prorateDaysUsed: daysUsed,
      prorateDaysRemaining: daysRemaining,
      currentWeeklyRub,
    };
  }

  if (id === "incoming_only") {
    return {
      planId: id,
      title: plan.title,
      kind: "new",
      currentTitle: currentPlan.title,
      chargeRub: 0,
      nextChargeAt: null,
      nextChargeLabel: null,
      effectiveAt: now,
      effectiveAtLabel: null,
      paidUntilLabel: "бессрочно",
      cityName: city?.name ?? player.city_id,
      weeklyRub: 0,
      isCurrent: false,
      prorateDaysUsed: null,
      prorateDaysRemaining: null,
      currentWeeklyRub,
    };
  }

  const chargeRub = weeklyRub;
  if (chargeRub > balance) {
    return {
      error: `На балансе сим ${formatRub(balance)}, нужно ${formatRub(chargeRub)}`,
    };
  }

  const nextChargeAt = now + SIM_TARIFF_WEEK_MS;
  return {
    planId: id,
    title: plan.title,
    kind: "new",
    currentTitle: currentPlan.title,
    chargeRub,
    nextChargeAt,
    nextChargeLabel: formatTariffPaidUntilLabel(id, nextChargeAt, timezone, now),
    effectiveAt: now,
    effectiveAtLabel: null,
    paidUntilLabel: formatTariffPaidUntilLabel(id, nextChargeAt, timezone, now),
    cityName: city?.name ?? player.city_id,
    weeklyRub,
    isCurrent: false,
    prorateDaysUsed: null,
    prorateDaysRemaining: null,
    currentWeeklyRub,
  };
}

export function selectSimTariff(
  userId: number,
  planId: string,
  now = Date.now(),
): { ok: true; planId: SimTariffId; paidUntil: number | null } | { ok: false; error: string } {
  let player = syncPlayerSimTariffBilling(userId, now);
  if (!player) return { ok: false, error: "Игрок не найден" };

  const quote = quoteSimTariff(player, planId, now);
  if ("error" in quote) return { ok: false, error: quote.error };

  const id = quote.planId;
  const balance = Math.floor(player.sim_balance_rub ?? 0);

  if (quote.kind === "downgrade") {
    if (getPlayerSimTariffId(player) === "incoming_only") {
      updatePlayer(userId, {
        sim_tariff_id: "incoming_only",
        sim_tariff_paid_until: null,
        sim_tariff_pending_id: null,
      });
      return { ok: true, planId: "incoming_only", paidUntil: null };
    }
    updatePlayer(userId, { sim_tariff_pending_id: id });
    return { ok: true, planId: id, paidUntil: player.sim_tariff_paid_until };
  }

  if (quote.kind === "upgrade") {
    updatePlayer(userId, {
      sim_tariff_id: id,
      sim_tariff_pending_id: null,
      sim_balance_rub: balance - quote.chargeRub,
    });
    return { ok: true, planId: id, paidUntil: player.sim_tariff_paid_until };
  }

  if (id === "incoming_only") {
    updatePlayer(userId, {
      sim_tariff_id: id,
      sim_tariff_paid_until: null,
      sim_tariff_pending_id: null,
    });
    return { ok: true, planId: id, paidUntil: null };
  }

  const paidUntil = now + SIM_TARIFF_WEEK_MS;
  updatePlayer(userId, {
    sim_tariff_id: id,
    sim_tariff_paid_until: paidUntil,
    sim_tariff_pending_id: null,
    sim_balance_rub: balance - quote.chargeRub,
  });
  return { ok: true, planId: id, paidUntil };
}

export function getSimTariffStatus(player: PlayerRow, now = Date.now()) {
  const city = getCity(player.city_id);
  const timezone = getCityTimezone(city);
  const tariffId = getPlayerSimTariffId(player);
  const plan = getSimTariffPlan(tariffId)!;
  const pendingId = player.sim_tariff_pending_id;
  const pendingPlan = pendingId ? getSimTariffPlan(pendingId) : undefined;
  return {
    tariffId,
    tariffTitle: plan.title,
    pendingId: pendingPlan ? (pendingId as SimTariffId) : null,
    pendingTitle: pendingPlan?.title ?? null,
    paidUntil: player.sim_tariff_paid_until,
    paidUntilLabel: formatTariffPaidUntilLabel(
      tariffId,
      player.sim_tariff_paid_until,
      timezone,
      now,
    ),
    pendingEffectiveLabel:
      pendingPlan && player.sim_tariff_paid_until
        ? formatTariffPaidUntilLabel(tariffId, player.sim_tariff_paid_until, timezone, now)
        : null,
    timezone,
    localTime: getCityLocalTime(timezone, now),
  };
}
