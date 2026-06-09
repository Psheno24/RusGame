import { formatRub } from "./formatRub.js";
import type { PlayerRow } from "./db.js";
import { getPlayer, updatePlayer } from "./db.js";
import { computeResaleValue } from "./assetTrade.js";
import type { AssetQuote } from "./carShop.js";
import { getPhoneShopPriceRub } from "./shopCatalog.js";
import { getSkill, SKILL_LABELS, recordSkillActionForTemplate, type SkillKey } from "./skills.js";
import { appendPlayerFeed } from "./playerFeed.js";
import {
  enrichJobWorkState,
  getCityLocalTime,
  getCityTimezone,
  getNextScheduleWindowAt,
  getPayoutMultiplier,
  isWorkScheduleAllowed,
  scheduleBlockedMessage,
  type CityLocalTime,
} from "./cityTime.js";
import { formatDuration } from "./formatDuration.js";
import {
  computeNightGuardShiftMinutes,
  formatShiftMinutesRu,
  isNightGuardJob,
  jobNominalCooldownMs,
  NIGHT_GUARD_MAX_SHIFT_HOURS,
  nightGuardStaminaEligible,
} from "./jobShift.js";
import {
  findCityJob,
  getCity,
  getPhone,
  getPhones,
  getTravel,
  jobRequiresPhone,
  type JobDef,
} from "./gameData.js";
import type { TravelMode } from "./travelCalc.js";
import { isCityResident, requireCityResident, syncPlayerHousing } from "./housing.js";
import {
  isEmergencyLoaderJob,
  LOADER_JOB_ID,
  LOADER_PAYOUT_RUB,
  playerEmployedAsLoader,
  playerWorksJob,
  shouldOfferEmergencyLoader,
  syncEmergencyLoaderEmployment,
} from "./emergencyLoader.js";
import { jobCityId, validateJobWorkAccess, workCityIdForPlayer } from "./jobLocation.js";
import {
  clampReputation,
  workPayoutMultiplier,
} from "./playerStats.js";
import { applyCarCooldownReduction, hasDriverLicense } from "./playerCars.js";
import { sleepBlockMessage } from "./playerSleep.js";
import { playerMeetsSimTariff, syncPlayerSimTariffBilling, type SimTariffId } from "./simTariff.js";
import {
  activeJobShiftBlock,
  canWorkJobNow,
  jobCooldownState,
  lastWorkRecordForJob,
  serializeLastWorkByJob,
  withLastWork,
} from "./workCooldown.js";
import { scaleTravelMs, scaleCooldownMs } from "./testAccount.js";
import { scheduleShiftReadyPush } from "./pushNotifications.js";
import { playerMeetsCarRequirement, taxiBlocksShift } from "./taxi.js";
import { saveTaxiState } from "./playerTaxi.js";
import { deliveryBlocksShift, clearDeliveryState } from "./delivery.js";
import { scaledWorkEnergyCost } from "./balanceBible.js";
import { effectiveMood } from "./housingMood.js";
import {
  applyPostWorkPassives,
  clampVital,
  scaleWorkCosts,
} from "./playerStats.js";

export { canWorkJobNow, formatCooldown } from "./workCooldown.js";
import { randInt } from "./random.js";
export { randInt } from "./random.js";

const CYR = "АВЕКМНОРСТУХ";

export function resolveTravel(player: PlayerRow, now = Date.now()): PlayerRow {
  if (player.status !== "traveling" || !player.travel_arrives_at) return player;
  if (now < player.travel_arrives_at) return player;

  const arrivedAt = player.travel_arrives_at;
  const to = player.travel_to_city_id ?? player.city_id;
  const dest = getCity(to);
  appendPlayerFeed(
    player.user_id,
    "travel:arrive",
    `Прибытие в ${dest?.name ?? to}`,
    arrivedAt,
  );
  const next: Partial<PlayerRow> = {
    status: "idle",
    city_id: to,
    travel_to_city_id: null,
    travel_arrives_at: null,
  };
  updatePlayer(player.user_id, next);
  const arrived = { ...player, ...next } as PlayerRow;
  syncPlayerSimTariffBilling(player.user_id, now);
  const synced = syncPlayerHousing(arrived, now);
  return getPlayer(player.user_id) ?? synced;
}

function cooldownBlockedMessage(remainingMs: number): string {
  return `Дождитесь окончания смены (ещё ${formatDuration(remainingMs)})`;
}

function checkJobRequirements(player: PlayerRow, job: JobDef): string | null {
  if (job.requiresDriversLicense && !hasDriverLicense(player, "B")) {
    return "Нужны права категории B — оформите в полиции";
  }
  if (job.requiresCar && !playerMeetsCarRequirement(player, Date.now())) {
    return "Нужен автомобиль (свой или аренда)";
  }
  if (jobRequiresPhone(job) && !player.phone_device_id) {
    return "Нужен телефон — купите в магазине (город → телефон → устройства)";
  }
  if (job.requiresSimTariff && !playerMeetsSimTariff(player, job.requiresSimTariff)) {
    const titles: Record<SimTariffId, string> = {
      incoming_only: "Только входящие",
      minimal: "Минимальный",
      connected: "На связи",
      unlimited: "Полный безлимит",
    };
    const need = titles[job.requiresSimTariff];
    return `Нужен тариф «${need}» — подключите в магазине (телефон → сим-карта → тарифы)`;
  }
  if (job.skill && job.skillMin != null) {
    const v = getSkill(player, job.skill as SkillKey);
    if (v < job.skillMin) {
      const name = SKILL_LABELS[job.skill as SkillKey] ?? job.skill;
      return `Нужен навык «${name}» ${job.skillMin}+ (у вас ${v})`;
    }
  }
  return null;
}

function checkJobSchedule(player: PlayerRow, job: JobDef, now: number):
  | { ok: true; localTime: CityLocalTime }
  | {
      ok: false;
      error: string;
      code: "outside_schedule";
      localTime: CityLocalTime;
      nextWindowAt: string | null;
    } {
  const city = getCity(player.city_id);
  const timezone = getCityTimezone(city);
  const localTime = getCityLocalTime(timezone, now);
  if (!job.schedule || isWorkScheduleAllowed(localTime, job.schedule)) {
    return { ok: true, localTime };
  }
  return {
    ok: false,
    error: scheduleBlockedMessage(localTime, job.schedule),
    code: "outside_schedule",
    localTime,
    nextWindowAt: getNextScheduleWindowAt(timezone, job.schedule, now),
  };
}

function calculateCooldownJobPayout(
  player: PlayerRow,
  job: JobDef,
  localTime: CityLocalTime,
): { payout: number; multiplier: number } {
  const mid = Math.floor(((job.payoutMin ?? 0) + (job.payoutMax ?? 0)) / 2);
  const base = randInt(job.payoutMin ?? mid, job.payoutMax ?? mid);
  const timeMult = getPayoutMultiplier(localTime.hour, job.payoutPeriods);
  const vitalMult = workPayoutMultiplier(player);
  const multiplier = timeMult * vitalMult;
  return { payout: Math.floor(base * multiplier), multiplier };
}

function calculateNightGuardPayout(
  player: PlayerRow,
  job: JobDef,
  localTime: CityLocalTime,
  shiftHours: number,
): { payout: number; multiplier: number } {
  const mid = Math.floor(((job.payoutMin ?? 0) + (job.payoutMax ?? 0)) / 2);
  const timeMult = getPayoutMultiplier(localTime.hour, job.payoutPeriods);
  const vitalMult = workPayoutMultiplier(player);
  const multiplier = timeMult * vitalMult;
  return { payout: Math.floor(mid * multiplier), multiplier };
}

function calculateDurationJobPayout(
  player: PlayerRow,
  job: JobDef,
  localTime: CityLocalTime,
  hours: number,
): { payout: number; multiplier: number } {
  const perHour = randInt(job.payoutPerHourMin ?? 0, job.payoutPerHourMax ?? 0);
  const timeMult = getPayoutMultiplier(localTime.hour, job.payoutPeriods);
  const vitalMult = workPayoutMultiplier(player);
  const multiplier = timeMult * vitalMult;
  return { payout: Math.floor(perHour * hours * multiplier), multiplier };
}

function payoutMessage(job: JobDef, payout: number, multiplier: number): string {
  const amount = `${formatRub(payout)}`;
  if (multiplier > 1) {
    const multLabel = multiplier.toFixed(2).replace(/\.?0+$/, "");
    return `${job.title}: +${amount} (×${multLabel})`;
  }
  return `${job.title}: +${amount}`;
}

export type WorkResult =
  | { ok: true; payout: number; message: string; skillGain?: { key: SkillKey; amount: number } }
  | {
      ok: false;
      error: string;
      readyAt?: number;
      code?: string;
      localTime?: CityLocalTime;
      nextWindowAt?: string | null;
      guestNoHousing?: boolean;
    };

export { enrichJobWorkState, getCityLocalTime, getCityTimezone };

export type ApplyJobResult =
  | { ok: true; message: string }
  | { ok: false; error: string; remainingMs?: number; code?: string }
  | { ok: false; kind: "confirm_switch"; jobId: string; currentTitle: string; newTitle: string };

export function applyJob(
  userId: number,
  jobId: string,
  opts?: { forceSwitch?: boolean },
  now = Date.now(),
): ApplyJobResult {
  let player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  player = resolveTravel(player, now);
  if (player.status === "traveling") return { ok: false, error: "Вы в пути" };
  const sleepErr = sleepBlockMessage(player, now);
  if (sleepErr) return { ok: false, error: sleepErr };

  const job = findCityJob(player.city_id, jobId);
  if (!job) return { ok: false, error: "Вакансия не найдена" };

  const isLoader = isEmergencyLoaderJob(job);
  if (isLoader) {
    if (!shouldOfferEmergencyLoader(player, now)) {
      return { ok: false, error: "Подработка «Грузчик» недоступна" };
    }
  } else {
    const guestErr = requireCityResident(player, now);
    if (guestErr) return { ok: false, error: guestErr, code: "guest_no_housing" };
  }

  if (isLoader && playerEmployedAsLoader(player)) {
    return { ok: false, error: "Вы уже устроены на эту работу" };
  }

  if (player.job_id === jobId) return { ok: false, error: "Вы уже устроены на эту работу" };

  if (!isLoader) {
    const reqErr = checkJobRequirements(player, job);
    if (reqErr) return { ok: false, error: reqErr };
  }

  if (player.job_id) {
    const workCity = jobCityId(player.job_id);
    const curJob = workCity ? findCityJob(workCity, player.job_id) : null;
    if (taxiBlocksShift(player)) {
      return {
        ok: false,
        error: "Сначала завершите поездку и сойдите с линии такси",
      };
    }
    if (deliveryBlocksShift(player)) {
      return {
        ok: false,
        error: "Сначала завершите доставку",
      };
    }
    const st = canWorkJobNow(player, player.job_id, now);
    if (!st.ok) {
      return {
        ok: false,
        error: cooldownBlockedMessage(st.remainingMs),
        remainingMs: st.remainingMs,
      };
    }
    if (!opts?.forceSwitch) {
      return {
        ok: false,
        kind: "confirm_switch",
        jobId,
        currentTitle: curJob?.title ?? "текущая работа",
        newTitle: job.title,
      };
    }
  }

  const prevJobId = player.job_id;
  updatePlayer(userId, { job_id: isLoader ? LOADER_JOB_ID : jobId });
  if (prevJobId && prevJobId !== jobId) {
    const prevCity = jobCityId(prevJobId);
    const prevJob = prevCity ? findCityJob(prevCity, prevJobId) : null;
    if (prevJob?.kind === "taxi_line") saveTaxiState(userId, null);
    if (prevJob?.kind === "delivery_line") clearDeliveryState(userId);
  }
  appendPlayerFeed(userId, "job:apply", `Устроились: ${job.title}`, now);
  return { ok: true, message: `Вы устроились: ${job.title}` };
}

export function quitJob(
  userId: number,
  jobId: string,
  now = Date.now(),
): { ok: true; message: string } | { ok: false; error: string; remainingMs?: number } {
  let player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  player = resolveTravel(player, now);
  if (player.status === "traveling") return { ok: false, error: "Вы в пути" };
  const sleepErr = sleepBlockMessage(player, now);
  if (sleepErr) return { ok: false, error: sleepErr };

  const workCity = workCityIdForPlayer(player, jobId);
  if (!workCity) return { ok: false, error: "Вакансия не найдена" };
  const job = findCityJob(workCity, jobId);
  if (!job) return { ok: false, error: "Вакансия не найдена" };

  if (!playerWorksJob(player, job)) return { ok: false, error: "Вы не устроены на эту работу" };

  if (taxiBlocksShift(player)) {
    return {
      ok: false,
      error: "Сначала завершите поездку и сойдите с линии такси",
    };
  }
  if (deliveryBlocksShift(player)) {
    return { ok: false, error: "Сначала завершите доставку" };
  }

  const st = canWorkJobNow(player, jobId, now);
  if (!st.ok) {
    return {
      ok: false,
      error: cooldownBlockedMessage(st.remainingMs),
      remainingMs: st.remainingMs,
    };
  }

  updatePlayer(userId, { job_id: null });
  if (job.kind === "taxi_line") saveTaxiState(userId, null);
  if (job.kind === "delivery_line") clearDeliveryState(userId);
  appendPlayerFeed(userId, "job:quit", `Уволились: ${job.title}`, now);
  return { ok: true, message: `Вы уволились: ${job.title}` };
}

export function doJobWork(userId: number, jobId: string, hours?: number, now = Date.now()): WorkResult {
  let player = syncPlayerSimTariffBilling(userId, now);
  if (!player) return { ok: false, error: "Игрок не найден" };
  player = resolveTravel(player, now);
  if (player.status === "traveling") return { ok: false, error: "Вы в пути — подождите прибытия" };
  const sleepErr = sleepBlockMessage(player, now);
  if (sleepErr) return { ok: false, error: sleepErr };
  player = syncPlayerSimTariffBilling(userId, now) ?? player;

  const workCity = workCityIdForPlayer(player, jobId);
  if (!workCity) return { ok: false, error: "Вакансия не найдена" };
  const job = findCityJob(workCity, jobId);
  if (!job) return { ok: false, error: "Вакансия не найдена" };

  const isLoader = isEmergencyLoaderJob(job);
  if (isLoader) {
    if (!shouldOfferEmergencyLoader(player, now)) {
      return { ok: false, error: "Подработка «Грузчик» недоступна" };
    }
  } else {
    const workErr = validateJobWorkAccess(player, jobId, now);
    if (workErr) {
      const guestNoHousing = !isCityResident(player, workCity, now);
      return {
        ok: false,
        error: workErr,
        code: guestNoHousing ? "guest_no_housing" : "remote_work_blocked",
        guestNoHousing,
      };
    }
  }

  if (!playerWorksJob(player, job)) {
    return { ok: false, error: "Сначала устройтесь на эту работу" };
  }

  if (job.kind === "taxi_line") {
    return { ok: false, error: "Таксист работает на линии — используйте раздел заказов" };
  }

  if (job.kind === "delivery_line") {
    return { ok: false, error: "Курьер получает заказы отдельно — нажмите «Получить заказ»" };
  }

  if (!isLoader) {
    const reqErr = checkJobRequirements(player, job);
    if (reqErr) return { ok: false, error: reqErr };
  }

  const schedule = checkJobSchedule(player, job, now);
  if (!schedule.ok) {
    return {
      ok: false,
      error: schedule.error,
      code: schedule.code,
      localTime: schedule.localTime,
      nextWindowAt: schedule.nextWindowAt,
    };
  }

  let shiftHours: number;
  let cooldownMs: number;

  if (job.kind === "duration") {
    const minH = job.shiftHoursMin ?? 4;
    const maxH = job.shiftHoursMax ?? 12;
    if (hours == null || !Number.isInteger(hours) || hours < minH || hours > maxH) {
      return { ok: false, error: `Укажите длительность смены: от ${minH} до ${maxH} ч` };
    }
    shiftHours = hours;
    cooldownMs = applyCarCooldownReduction(userId, hours * 3600000);
  } else if (isNightGuardJob(job)) {
    if (hours != null) {
      return { ok: false, error: "Для этой работы длительность смены не выбирается" };
    }
    const endHour = job.shiftEndsAtHour ?? 8;
    const shiftMinutes = computeNightGuardShiftMinutes(
      schedule.localTime.hour,
      schedule.localTime.minute,
      endHour,
    );
    if (shiftMinutes <= 0) {
      return {
        ok: false,
        error: `Смена до ${String(endHour).padStart(2, "0")}:00 уже закончилась. Выходите с 22:00.`,
        code: "outside_schedule",
        localTime: schedule.localTime,
      };
    }
    shiftHours = shiftMinutes / 60;
    cooldownMs = applyCarCooldownReduction(userId, shiftMinutes * 60_000);
  } else {
    if (hours != null) {
      return { ok: false, error: "Для этой работы длительность смены не выбирается" };
    }
    shiftHours = job.shiftHours ?? 0;
    cooldownMs = applyCarCooldownReduction(userId, jobNominalCooldownMs(job));
  }

  const cd = jobCooldownState(player, job, now);
  if (!cd.ready) {
    return {
      ok: false,
      error: "Смена ещё не готова",
      readyAt: cd.effectiveReadyAt ?? now,
    };
  }

  const payoutResult = isLoader
    ? { payout: LOADER_PAYOUT_RUB, multiplier: 1 }
    : job.kind === "duration"
      ? calculateDurationJobPayout(player, job, schedule.localTime, shiftHours)
      : isNightGuardJob(job)
        ? calculateNightGuardPayout(player, job, schedule.localTime, shiftHours)
        : calculateCooldownJobPayout(player, job, schedule.localTime);

  const patch: Partial<PlayerRow> = {
    rubles: player.rubles + payoutResult.payout,
    last_work_at_by_job: serializeLastWorkByJob(withLastWork(player, job.id, now, cooldownMs)),
  };

  if (job.kind === "cooldown") {
    patch.reputation = clampReputation((player.reputation ?? 0) + 2);
  }

  const templateKey = job.templateKey ?? "";
  const energyCost = scaleWorkCosts(player, {
    energy: scaledWorkEnergyCost(templateKey, effectiveMood(player)),
  })?.energy;
  if (energyCost && energyCost > 0) {
    patch.energy = clampVital(
      "energy",
      (patch.energy ?? player.energy ?? 80) - energyCost,
    );
  }
  Object.assign(patch, applyPostWorkPassives(player, patch));

  let skillGain: { key: SkillKey; amount: number } | undefined;
  const grantSkillProgress =
    !isLoader &&
    (!isNightGuardJob(job) ||
      nightGuardStaminaEligible(schedule.localTime, job.shiftEndsAtHour ?? 8));
  if (grantSkillProgress && job.templateKey) {
    const skillResult = recordSkillActionForTemplate(player, job.templateKey);
    Object.assign(patch, skillResult.patch);
    skillGain = skillResult.granted;
  }

  updatePlayer(userId, patch);

  if (isLoader) syncEmergencyLoaderEmployment(userId, now);

  const { payout, multiplier } = payoutResult;
  let message =
    job.kind === "duration"
      ? `${job.title} (${shiftHours} ч): +${formatRub(payout)}`
      : isNightGuardJob(job)
        ? `${job.title} (до ${String(job.shiftEndsAtHour ?? 8).padStart(2, "0")}:00, ${formatShiftMinutesRu(
            computeNightGuardShiftMinutes(
              schedule.localTime.hour,
              schedule.localTime.minute,
              job.shiftEndsAtHour ?? 8,
            ),
          )}): +${formatRub(payout)}`
        : payoutMessage(job, payout, multiplier);

  if (multiplier > 1 && job.kind === "duration") {
    const multLabel = multiplier.toFixed(2).replace(/\.?0+$/, "");
    message += ` (×${multLabel})`;
  }

  const feedType = job.kind === "duration" ? "work:shift" : "work:side";
  const feedText =
    job.kind === "duration"
      ? `Смена «${job.title}» (${shiftHours} ч): +${formatRub(payout)}`
      : `Работа «${job.title}»: +${formatRub(payout)}`;
  appendPlayerFeed(userId, feedType, feedText, now);

  scheduleShiftReadyPush(userId, job.id, job.title, now + scaleCooldownMs(cooldownMs, userId));

  return { ok: true, payout, message, skillGain };
}

export function doSideGig(userId: number, now = Date.now()): WorkResult {
  const player = getPlayer(userId);
  if (!player?.job_id) return { ok: false, error: "Нет активной работы" };
  return doJobWork(userId, player.job_id, undefined, now);
}

export function doShift(userId: number, now = Date.now()): WorkResult {
  return doSideGig(userId, now);
}

export type TravelResult =
  | { ok: true; arrivesAt: number; priceRub: number }
  | { ok: false; error: string; remainingMs?: number };

export function startTravel(
  userId: number,
  toCityId: string,
  mode: TravelMode = "train",
  now = Date.now(),
): TravelResult {
  let player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  player = resolveTravel(player, now);
  if (player.status === "traveling") return { ok: false, error: "Уже в пути" };
  if (player.city_id === toCityId) return { ok: false, error: "Вы уже в этом городе" };
  const sleepErr = sleepBlockMessage(player, now);
  if (sleepErr) return { ok: false, error: sleepErr };

  const shiftBlock = activeJobShiftBlock(player, now);
  if (shiftBlock.blocked) {
    return {
      ok: false,
      error: cooldownBlockedMessage(shiftBlock.remainingMs),
      remainingMs: shiftBlock.remainingMs,
    };
  }

  const dest = getCity(toCityId);
  if (!dest) return { ok: false, error: "Город не найден" };

  const route = getTravel(player.city_id, toCityId, mode);
  if (!route) {
    return mode === "plane"
      ? { ok: false, error: "Прямых рейсов между этими городами нет" }
      : { ok: false, error: "Маршрут недоступен" };
  }

  if (player.rubles < route.priceRub) {
    return { ok: false, error: `Не хватает денег (нужно ${formatRub(route.priceRub)})` };
  }

  const arrivesAt = now + scaleTravelMs(route.durationMs, userId);
  appendPlayerFeed(
    userId,
    "travel:depart",
    `${route.mode === "plane" ? "Перелёт" : "Поездка"} в ${dest.name} (−${formatRub(route.priceRub)})`,
    now,
  );
  updatePlayer(userId, {
    rubles: player.rubles - route.priceRub,
    status: "traveling",
    travel_to_city_id: toCityId,
    travel_arrives_at: arrivesAt,
  });
  return { ok: true, arrivesAt, priceRub: route.priceRub };
}

const LICENSE_PRICE = 28000;

export type { AssetQuote } from "./carShop.js";
export {
  buyCar,
  listCarCatalog,
  listCarCategoriesWithCounts,
  listCarsInCategory,
  listOwnedCars,
  quoteCarPurchase,
  quoteCarSell,
  sellCar,
  tradeInForCar,
} from "./carShop.js";
export {
  buyDriverLicenseCategory,
  getDriverLicenseShop,
  getPlayerLicenseCategories,
} from "./driverLicense.js";
import { buyDriverLicenseCategory } from "./driverLicense.js";

/** @deprecated use buyDriverLicenseCategory(userId, "B") */
export function buyDriversLicense(
  userId: number,
): { ok: true } | { ok: false; error: string } {
  return buyDriverLicenseCategory(userId, "B");
}

export type PhoneCatalogItem = {
  id: string;
  brand: string;
  model: string;
  priceRub: number;
  accent: string;
  screen: string;
  ram: string;
  storage: string;
  battery: string;
  camera: string;
  os: string;
  listPriceRub: number;
  netPriceRub: number | null;
  tradeInRub: number;
  isOwned: boolean;
  canBuy: boolean;
  quoteError: string | null;
};

export function listPhoneCatalog(player: PlayerRow, now = Date.now()): PhoneCatalogItem[] {
  return getPhones().map((d) => {
    const base = {
      id: d.id,
      brand: d.brand,
      model: d.model,
      priceRub: d.priceRub,
      accent: d.accent,
      screen: d.screen,
      ram: d.ram,
      storage: d.storage,
      battery: d.battery,
      camera: d.camera,
      os: d.os,
      listPriceRub: d.priceRub,
      netPriceRub: d.priceRub as number | null,
      tradeInRub: 0,
      isOwned: player.phone_device_id === d.id,
      canBuy: false,
      quoteError: null as string | null,
    };
    if (player.phone_device_id === d.id) {
      return { ...base, netPriceRub: null };
    }
    const q = quotePhonePurchase(player, d.id, now);
    if ("error" in q) {
      return { ...base, netPriceRub: null, quoteError: q.error };
    }
    return {
      ...base,
      listPriceRub: q.listPriceRub,
      netPriceRub: q.netPriceRub,
      tradeInRub: q.tradeInRub,
      canBuy: true,
      priceRub: q.netPriceRub,
    };
  });
}

export function quotePhonePurchase(
  player: PlayerRow,
  deviceId: string,
  now = Date.now(),
): AssetQuote | { error: string } {
  const listPriceRub = getPhoneShopPriceRub(deviceId);
  if (listPriceRub == null) return { error: "Модель не найдена" };
  const tradeInCatalogPriceRub = player.phone_device_id
    ? getPhoneShopPriceRub(player.phone_device_id)
    : null;
  let tradeInRub = 0;
  if (tradeInCatalogPriceRub != null) {
    if (listPriceRub <= tradeInCatalogPriceRub) {
      return { error: "Можно купить только модель дороже текущей" };
    }
    tradeInRub = computeResaleValue(
      tradeInCatalogPriceRub,
      "phone",
      player.phone_acquired_at,
      now,
      "trade_in",
    );
  }
  return {
    listPriceRub,
    tradeInRub,
    netPriceRub: listPriceRub - tradeInRub,
    resaleRatePct: tradeInCatalogPriceRub
      ? Math.round((tradeInRub / tradeInCatalogPriceRub) * 100)
      : 0,
    tradeInCatalogPriceRub,
  };
}

export function buyPhoneDevice(
  userId: number,
  deviceId: string,
): { ok: true; deviceName: string; tradeInRub: number } | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  const device = getPhone(deviceId);
  if (!device) return { ok: false, error: "Модель не найдена" };
  if (player.phone_device_id === deviceId) {
    return { ok: false, error: "Этот телефон уже у вас" };
  }
  const now = Date.now();
  const quote = quotePhonePurchase(player, deviceId, now);
  if ("error" in quote) return { ok: false, error: quote.error };
  if (player.rubles < quote.netPriceRub) {
    return { ok: false, error: `Нужно ${formatRub(quote.netPriceRub)}` };
  }
  updatePlayer(userId, {
    rubles: player.rubles - quote.netPriceRub,
    phone_device_id: deviceId,
    phone_acquired_at: now,
  });
  const deviceName = `${device.brand} ${device.model}`;
  appendPlayerFeed(userId, "shop:phone", `Купили телефон ${deviceName}`, now);
  return { ok: true, deviceName, tradeInRub: quote.tradeInRub };
}

export function quotePhoneSell(
  player: PlayerRow,
  now = Date.now(),
): { amountRub: number; catalogPriceRub: number } | { error: string } {
  if (!player.phone_device_id) return { error: "У вас нет телефона" };
  const catalogPriceRub = getPhoneShopPriceRub(player.phone_device_id);
  if (catalogPriceRub == null) return { error: "Модель не найдена" };
  return {
    catalogPriceRub,
    amountRub: computeResaleValue(catalogPriceRub, "phone", player.phone_acquired_at, now, "sell"),
  };
}

export function sellPhoneDevice(
  userId: number,
): { ok: true; amountRub: number } | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  if (!player.phone_device_id) return { ok: false, error: "У вас нет телефона" };
  const current = getPhone(player.phone_device_id);
  if (!current) return { ok: false, error: "Модель не найдена" };
  const catalogPriceRub = getPhoneShopPriceRub(player.phone_device_id);
  if (catalogPriceRub == null) return { ok: false, error: "Модель не найдена" };
  const now = Date.now();
  const amountRub = computeResaleValue(catalogPriceRub, "phone", player.phone_acquired_at, now, "sell");
  updatePlayer(userId, {
    rubles: player.rubles + amountRub,
    phone_device_id: null,
    phone_acquired_at: null,
  });
  appendPlayerFeed(
    userId,
    "shop:phone",
    `Продали телефон ${current.brand} ${current.model} (+${formatRub(amountRub)})`,
    now,
  );
  return { ok: true, amountRub };
}

export const SHOP_PRICES = { driversLicense: LICENSE_PRICE };
