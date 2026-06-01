import type { PlayerRow } from "./db.js";
import { getPlayer, updatePlayer } from "./db.js";
import { getSkill, type SkillKey } from "./auth.js";
import { appendCityFeed, feedActorName } from "./cityFeed.js";
import { getCity, getCityJobs, getPhone, getTravel, jobRequiresSim, type JobDef } from "./gameData.js";
import { playerHasSim } from "./simNumber.js";
import {
  canWorkJobNow,
  jobCooldownState,
  lastWorkAtForJob,
  serializeLastWorkAtByJob,
  withLastWorkAt,
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

export type WorkResult =
  | { ok: true; payout: number; message: string; skillGain?: { key: SkillKey; amount: number } }
  | { ok: false; error: string; readyAt?: number };

export type ApplyJobResult =
  | { ok: true; message: string }
  | { ok: false; error: string; remainingMs?: number }
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

  const jobs = getCityJobs(player.city_id);
  if (!jobs) return { ok: false, error: "В этом городе пока нет вакансий" };

  const job =
    jobs.sideGig.id === jobId ? jobs.sideGig : jobs.shift.id === jobId ? jobs.shift : null;
  if (!job) return { ok: false, error: "Вакансия не найдена" };

  if (player.job_id === jobId) return { ok: false, error: "Вы уже устроены на эту работу" };

  const reqErr = checkJobRequirements(player, job);
  if (reqErr) return { ok: false, error: reqErr };

  if (player.job_id) {
    const curJob =
      jobs.sideGig.id === player.job_id
        ? jobs.sideGig
        : jobs.shift.id === player.job_id
          ? jobs.shift
          : null;
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

  const jobs = getCityJobs(player.city_id);
  if (!jobs) return { ok: false, error: "В этом городе пока нет вакансий" };

  const job =
    jobs.sideGig.id === jobId ? jobs.sideGig : jobs.shift.id === jobId ? jobs.shift : null;
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

export function doSideGig(userId: number, now = Date.now()): WorkResult {
  let player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  player = resolveTravel(player, now);
  if (player.status === "traveling") return { ok: false, error: "Вы в пути — подождите прибытия" };

  const jobs = getCityJobs(player.city_id);
  if (!jobs) return { ok: false, error: "В этом городе пока нет подработок" };

  const job = jobs.sideGig;
  if (player.job_id !== job.id) {
    return { ok: false, error: "Сначала устройтесь на эту подработку" };
  }

  const cd = jobCooldownState(player, job, now);
  if (!cd.ready) {
    return {
      ok: false,
      error: "Подработка ещё не готова",
      readyAt: lastWorkAtForJob(player, job.id) + job.cooldownMs,
    };
  }

  const payout = randInt(job.payoutMin, job.payoutMax);
  updatePlayer(userId, {
    rubles: player.rubles + payout,
    last_work_at_by_job: serializeLastWorkAtByJob(withLastWorkAt(player, job.id, now)),
  });
  const name = feedActorName(userId);
  appendCityFeed(
    player.city_id,
    "work:side",
    `${name} — ${job.title}: +${payout.toLocaleString("ru-RU")} ₽`,
    userId,
  );
  return { ok: true, payout, message: `${job.title}: +${payout.toLocaleString("ru-RU")} ₽` };
}

export function doShift(userId: number, now = Date.now()): WorkResult {
  let player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  player = resolveTravel(player, now);
  if (player.status === "traveling") return { ok: false, error: "Вы в пути" };

  const jobs = getCityJobs(player.city_id);
  if (!jobs) return { ok: false, error: "В этом городе пока нет смен" };

  const job = jobs.shift;
  if (player.job_id !== job.id) {
    return { ok: false, error: "Сначала устройтесь на эту смену" };
  }

  const reqErr = checkJobRequirements(player, job);
  if (reqErr) return { ok: false, error: reqErr };

  const cd = jobCooldownState(player, job, now);
  if (!cd.ready) {
    const last = lastWorkAtForJob(player, job.id);
    return { ok: false, error: "Смена ещё не готова", readyAt: last + job.cooldownMs };
  }

  const payout = randInt(job.payoutMin, job.payoutMax);
  const patch: Partial<PlayerRow> = {
    rubles: player.rubles + payout,
    last_work_at_by_job: serializeLastWorkAtByJob(withLastWorkAt(player, job.id, now)),
  };
  let skillGain: { key: SkillKey; amount: number } | undefined;
  if (job.skill && job.skillGain) {
    const key = job.skill as SkillKey;
    patch[key] = getSkill(player, key) + job.skillGain;
    skillGain = { key, amount: job.skillGain };
  }
  updatePlayer(userId, patch);
  const name = feedActorName(userId);
  let feedText = `${name} вышел на смену: **${job.title}** — +${payout.toLocaleString("ru-RU")} ₽`;
  if (skillGain) {
    const skillNames: Record<SkillKey, string> = {
      agility: "Ловкость",
      stamina: "Стойкость",
      charisma: "Общение",
      wit: "Смекалка",
    };
    feedText += ` · +${skillGain.amount} ${skillNames[skillGain.key]}`;
  }
  appendCityFeed(player.city_id, "work:shift", feedText.replace(/\*\*/g, ""), userId);
  return {
    ok: true,
    payout,
    message: `${job.title}: +${payout.toLocaleString("ru-RU")} ₽`,
    skillGain,
  };
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

export const SHOP_PRICES = { car: CAR_PRICE };
