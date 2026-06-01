import type { PlayerRow } from "./db.js";
import { getPlayer, updatePlayer } from "./db.js";
import { getSkill, type SkillKey } from "./auth.js";
import { appendCityFeed, feedActorName } from "./cityFeed.js";
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
import {
  findCityJob,
  getCity,
  getCityJobs,
  getPhone,
  getTravel,
  jobRequiresSim,
  type JobDef,
} from "./gameData.js";
import { applyWorkStatCosts } from "./actions.js";
import { requireCityResident } from "./housing.js";
import {
  applyPostWorkPassives,
  canAffordCosts,
  clampReputation,
  scaleWorkCosts,
  type StatCosts,
  workPayoutMultiplier,
} from "./playerStats.js";
import { playerHasSim } from "./simNumber.js";
import {
  canWorkJobNow,
  jobCooldownState,
  lastWorkRecordForJob,
  serializeLastWorkByJob,
  withLastWork,
} from "./workCooldown.js";

export { canWorkJobNow, formatCooldown } from "./workCooldown.js";

const CYR = "АВЕКМНОРСТУХ";

export function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function resolveTravel(player: PlayerRow, now = Date.now()): PlayerRow {
  if (player.status !== "traveling" || !player.travel_arrives_at) return player;
  if (now < player.travel_arrives_at) return player;
  const to = player.travel_to_city_id ?? player.city_id;
  const dest = getCity(to);
  const name = feedActorName(player.user_id);
  appendCityFeed(
    to,
    "travel:arrive",
    `${name} прибыл в город ${dest?.name ?? to}`,
    player.user_id,
  );
  const next: Partial<PlayerRow> = {
    status: "idle",
    city_id: to,
    travel_to_city_id: null,
    travel_arrives_at: null,
    job_id: null,
  };
  updatePlayer(player.user_id, next);
  return { ...player, ...next } as PlayerRow;
}

function cooldownBlockedMessage(remainingMs: number): string {
  return `Дождитесь окончания перерыва (${Math.ceil(remainingMs / 60000)} мин)`;
}

function checkJobRequirements(player: PlayerRow, job: JobDef): string | null {
  if (job.requiresDriversLicense && !player.drivers_license) {
    return "Нужны водительские права — оформите в магазине (раздел «Авто»)";
  }
  if (jobRequiresSim(job) && !playerHasSim(player)) {
    return "Нужна сим-карта — оформите в магазине (телефон → сим-карта)";
  }
  if (job.skill && job.skillMin != null) {
    const v = getSkill(player, job.skill as SkillKey);
    if (v < job.skillMin) {
      const names: Record<SkillKey, string> = {
        agility: "Ловкость",
        stamina: "Стойкость",
        charisma: "Общение",
        wit: "Смекалка",
      };
      return `Нужна ${names[job.skill as SkillKey]} ${job.skillMin}+ (у вас ${v})`;
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
  const base = randInt(job.payoutMin ?? 0, job.payoutMax ?? 0);
  const timeMult = getPayoutMultiplier(localTime.hour, job.payoutPeriods);
  const vitalMult = workPayoutMultiplier(player);
  const multiplier = timeMult * vitalMult;
  return { payout: Math.floor(base * multiplier), multiplier };
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

function scaleWorkCostsByHours(
  costs: StatCosts | undefined,
  hours: number,
  baselineHours = 8,
): StatCosts | undefined {
  if (!costs) return undefined;
  const factor = hours / baselineHours;
  const scaled: StatCosts = {};
  if (costs.energy != null) scaled.energy = Math.ceil(costs.energy * factor);
  if (costs.hunger != null) scaled.hunger = Math.ceil(costs.hunger * factor);
  if (costs.mood != null) scaled.mood = Math.ceil(costs.mood * factor);
  return scaled;
}

function payoutMessage(job: JobDef, payout: number, multiplier: number): string {
  const amount = `${payout.toLocaleString("ru-RU")} ₽`;
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

  const guestErr = requireCityResident(player, now);
  if (guestErr) return { ok: false, error: guestErr, code: "guest_no_housing" };

  const cityJobs = getCityJobs(player.city_id);
  if (cityJobs.length === 0) return { ok: false, error: "В этом городе пока нет вакансий" };

  const job = findCityJob(player.city_id, jobId);
  if (!job) return { ok: false, error: "Вакансия не найдена" };

  if (player.job_id === jobId) return { ok: false, error: "Вы уже устроены на эту работу" };

  const reqErr = checkJobRequirements(player, job);
  if (reqErr) return { ok: false, error: reqErr };

  if (player.job_id) {
    const curJob = findCityJob(player.city_id, player.job_id);
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

  updatePlayer(userId, { job_id: jobId });
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

  const cityJobs = getCityJobs(player.city_id);
  if (cityJobs.length === 0) return { ok: false, error: "В этом городе пока нет вакансий" };

  const job = findCityJob(player.city_id, jobId);
  if (!job) return { ok: false, error: "Вакансия не найдена" };

  if (player.job_id !== jobId) return { ok: false, error: "Вы не устроены на эту работу" };

  const st = canWorkJobNow(player, jobId, now);
  if (!st.ok) {
    return {
      ok: false,
      error: cooldownBlockedMessage(st.remainingMs),
      remainingMs: st.remainingMs,
    };
  }

  updatePlayer(userId, { job_id: null });
  return { ok: true, message: `Вы уволились: ${job.title}` };
}

export function doJobWork(userId: number, jobId: string, hours?: number, now = Date.now()): WorkResult {
  let player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  player = resolveTravel(player, now);
  if (player.status === "traveling") return { ok: false, error: "Вы в пути — подождите прибытия" };

  const guestErr = requireCityResident(player, now);
  if (guestErr) {
    return { ok: false, error: guestErr, code: "guest_no_housing", guestNoHousing: true };
  }

  const job = findCityJob(player.city_id, jobId);
  if (!job) return { ok: false, error: "Вакансия не найдена" };

  if (player.job_id !== job.id) {
    return { ok: false, error: "Сначала устройтесь на эту работу" };
  }

  const reqErr = checkJobRequirements(player, job);
  if (reqErr) return { ok: false, error: reqErr };

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
  let workCosts = job.workCosts;

  if (job.kind === "duration") {
    const minH = job.shiftHoursMin ?? 4;
    const maxH = job.shiftHoursMax ?? 12;
    if (hours == null || !Number.isInteger(hours) || hours < minH || hours > maxH) {
      return { ok: false, error: `Укажите длительность смены: от ${minH} до ${maxH} ч` };
    }
    shiftHours = hours;
    cooldownMs = hours * 3600000;
    workCosts = scaleWorkCostsByHours(job.workCosts, hours);
  } else {
    if (hours != null) {
      return { ok: false, error: "Для этой работы длительность смены не выбирается" };
    }
    shiftHours = 0;
    cooldownMs = job.cooldownMs ?? 0;
  }

  const scaledCosts = scaleWorkCosts(player, workCosts);
  const lifeErr = canAffordCosts(player, scaledCosts);
  if (lifeErr) return { ok: false, error: lifeErr };

  const cd = jobCooldownState(player, job, now);
  if (!cd.ready) {
    const record = lastWorkRecordForJob(player, job.id);
    const readyAt = record ? record.at + cooldownMs : now;
    return { ok: false, error: "Смена ещё не готова", readyAt };
  }

  const payoutResult =
    job.kind === "duration"
      ? calculateDurationJobPayout(player, job, schedule.localTime, shiftHours)
      : calculateCooldownJobPayout(player, job, schedule.localTime);

  const statPatch = applyWorkStatCosts(player, scaledCosts);
  const patch: Partial<PlayerRow> = {
    ...statPatch,
    ...applyPostWorkPassives(player, statPatch),
    rubles: player.rubles + payoutResult.payout,
    last_work_at_by_job: serializeLastWorkByJob(withLastWork(player, job.id, now, cooldownMs)),
  };

  if (job.kind === "cooldown") {
    patch.reputation = clampReputation((player.reputation ?? 100) + 2);
  }

  let skillGain: { key: SkillKey; amount: number } | undefined;
  if (job.skill && job.skillGain) {
    const key = job.skill as SkillKey;
    patch[key] = getSkill(player, key) + job.skillGain;
    skillGain = { key, amount: job.skillGain };
  }

  updatePlayer(userId, patch);

  const { payout, multiplier } = payoutResult;
  let message =
    job.kind === "duration"
      ? `${job.title} (${shiftHours} ч): +${payout.toLocaleString("ru-RU")} ₽`
      : payoutMessage(job, payout, multiplier);

  if (multiplier > 1 && job.kind === "duration") {
    const multLabel = multiplier.toFixed(2).replace(/\.?0+$/, "");
    message += ` (×${multLabel})`;
  }

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
  | { ok: false; error: string };

export function startTravel(userId: number, toCityId: string, now = Date.now()): TravelResult {
  let player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  player = resolveTravel(player, now);
  if (player.status === "traveling") return { ok: false, error: "Уже в пути" };
  if (player.city_id === toCityId) return { ok: false, error: "Вы уже в этом городе" };

  const dest = getCity(toCityId);
  if (!dest) return { ok: false, error: "Город не найден" };

  const route = getTravel(player.city_id, toCityId);
  if (!route) return { ok: false, error: "Маршрут пока не открыт (скоро добавим)" };

  if (player.rubles < route.priceRub) {
    return { ok: false, error: `Не хватает денег (нужно ${route.priceRub.toLocaleString("ru-RU")} ₽)` };
  }

  const arrivesAt = now + route.durationMs;
  const name = feedActorName(userId);
  appendCityFeed(
    player.city_id,
    "travel:depart",
    `${name} уехал в ${dest.name} (−${route.priceRub.toLocaleString("ru-RU")} ₽)`,
    userId,
  );
  updatePlayer(userId, {
    rubles: player.rubles - route.priceRub,
    status: "traveling",
    travel_to_city_id: toCityId,
    travel_arrives_at: arrivesAt,
    job_id: null,
  });
  return { ok: true, arrivesAt, priceRub: route.priceRub };
}

export function randomPlateLetter(): string {
  return CYR[randInt(0, CYR.length - 1)]!;
}

export function generatePlate(): string {
  const l1 = randomPlateLetter();
  const digits = String(randInt(100, 999));
  const l2 = randomPlateLetter() + randomPlateLetter();
  const region = String(randInt(1, 199));
  return `${l1}${digits}${l2} ${region}`;
}

const CAR_PRICE = 280000;
const LICENSE_PRICE = 28000;

export function buyDriversLicense(
  userId: number,
): { ok: true } | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  if (player.drivers_license) return { ok: false, error: "Права уже есть" };
  if (player.rubles < LICENSE_PRICE) {
    return { ok: false, error: `Нужно ${LICENSE_PRICE.toLocaleString("ru-RU")} ₽` };
  }
  updatePlayer(userId, { rubles: player.rubles - LICENSE_PRICE, drivers_license: 1 });
  return { ok: true };
}

export function buyCar(userId: number): { ok: true; plate: string } | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  if (player.car_owned) return { ok: false, error: "Машина уже есть" };
  if (player.rubles < CAR_PRICE) return { ok: false, error: `Нужно ${CAR_PRICE.toLocaleString("ru-RU")} ₽` };
  const plate = generatePlate();
  updatePlayer(userId, { rubles: player.rubles - CAR_PRICE, car_owned: 1, plate_text: plate });
  const name = feedActorName(userId);
  appendCityFeed(
    player.city_id,
    "shop:car",
    `${name} купил авто, номер ${plate}`,
    userId,
  );
  return { ok: true, plate };
}

export function buyPhoneDevice(
  userId: number,
  deviceId: string,
): { ok: true; deviceName: string } | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  const device = getPhone(deviceId);
  if (!device) return { ok: false, error: "Модель не найдена" };
  if (player.phone_device_id === deviceId) {
    return { ok: false, error: "Этот телефон уже у вас" };
  }
  if (player.rubles < device.priceRub) {
    return { ok: false, error: `Нужно ${device.priceRub.toLocaleString("ru-RU")} ₽` };
  }
  updatePlayer(userId, {
    rubles: player.rubles - device.priceRub,
    phone_device_id: deviceId,
  });
  const name = feedActorName(userId);
  const deviceName = `${device.brand} ${device.model}`;
  appendCityFeed(
    player.city_id,
    "shop:phone",
    `${name} купил телефон ${deviceName}`,
    userId,
  );
  return { ok: true, deviceName };
}

export const SHOP_PRICES = { car: CAR_PRICE, driversLicense: LICENSE_PRICE };
