import type { PlayerRow } from "./db.js";
import { getPlayer, updatePlayer } from "./db.js";
import type { JobDef } from "./gameData.js";
import { getCities, getCity } from "./gameData.js";
import { dormDayPriceRub, playerHasAnyHousing } from "./housing.js";
import { appendPlayerFeed } from "./playerFeed.js";
import {
  parseLastWorkByJob,
  serializeLastWorkByJob,
} from "./workCooldown.js";
import { computeTravelRoute } from "./travelCalc.js";

export const LOADER_COOLDOWN_MS = 30 * 60 * 1000;
export const LOADER_PAYOUT_RUB = 500;
export const LOADER_TEMPLATE_KEY = "loader";
/** Одна подработка «Грузчик» на все города. */
export const LOADER_JOB_ID = "loader";

export type EmergencyLoaderTravelAdvice = {
  cityId: string;
  cityName: string;
  ticketRub: number;
  dormDayRub: number;
  totalRub: number;
  savingsRub: number;
  localEarnShifts: number;
  travelEarnShifts: number;
  travelDurationMs: number;
};

export type EmergencyLoaderBrief = {
  cityName: string;
  dormDayRub: number;
  rubles: number;
  needRub: number;
  loaderPayoutRub: number;
  shiftsToDorm: number;
  travelAdvice: EmergencyLoaderTravelAdvice | null;
};

export function emergencyLoaderJobId(_cityId?: string): string {
  return LOADER_JOB_ID;
}

export function isEmergencyLoaderJob(job: Pick<JobDef, "id" | "templateKey">): boolean {
  return job.templateKey === LOADER_TEMPLATE_KEY;
}

export function isEmergencyLoaderJobId(jobId: string): boolean {
  return jobId === LOADER_JOB_ID || jobId.endsWith(`_${LOADER_TEMPLATE_KEY}`);
}

export function playerEmployedAsLoader(player: Pick<PlayerRow, "job_id">): boolean {
  return player.job_id != null && isEmergencyLoaderJobId(player.job_id);
}

export function playerWorksJob(
  player: Pick<PlayerRow, "job_id">,
  job: Pick<JobDef, "id" | "templateKey">,
): boolean {
  if (isEmergencyLoaderJob(job)) return playerEmployedAsLoader(player);
  return player.job_id === job.id;
}

export function shiftsToAffordRub(gapRub: number, payoutRub = LOADER_PAYOUT_RUB): number {
  if (gapRub <= 0) return 0;
  return Math.ceil(gapRub / payoutRub);
}

/** Подработка «Грузчик»: нет жилья и не хватает на сутки общежития в текущем городе. */
export function shouldOfferEmergencyLoader(player: PlayerRow, now = Date.now()): boolean {
  if (player.status === "traveling") return false;
  if (playerHasAnyHousing(player, now)) return false;
  return player.rubles < dormDayPriceRub(player.city_id);
}

function migrateLoaderJobId(userId: number, player: PlayerRow): void {
  if (!playerEmployedAsLoader(player) || player.job_id === LOADER_JOB_ID) return;

  const map = parseLastWorkByJob(player);
  const legacy = player.job_id ? map[player.job_id] : undefined;
  if (legacy && !map[LOADER_JOB_ID]) {
    map[LOADER_JOB_ID] = legacy;
    delete map[player.job_id!];
  }

  updatePlayer(userId, {
    job_id: LOADER_JOB_ID,
    last_work_at_by_job: serializeLastWorkByJob(map),
  });
}

/** Снимает с грузчика и нормализует job_id, когда подработка больше не нужна. */
export function syncEmergencyLoaderEmployment(userId: number, now = Date.now()): void {
  const player = getPlayer(userId);
  if (!player || !playerEmployedAsLoader(player)) return;

  if (shouldOfferEmergencyLoader(player, now)) {
    migrateLoaderJobId(userId, player);
    return;
  }

  updatePlayer(userId, { job_id: null });
  appendPlayerFeed(
    userId,
    "job:quit",
    "Подработка «Грузчик» завершена — хватает на жильё в этом городе",
    now,
  );
}

export function buildEmergencyLoaderBrief(player: PlayerRow, now = Date.now()): EmergencyLoaderBrief | null {
  if (!shouldOfferEmergencyLoader(player, now)) return null;

  const cityId = player.city_id;
  const city = getCity(cityId);
  const dormDayRub = dormDayPriceRub(cityId);
  const needRub = Math.max(0, dormDayRub - player.rubles);

  let travelAdvice: EmergencyLoaderTravelAdvice | null = null;
  let bestTotal = Infinity;

  for (const dest of getCities()) {
    if (!dest.playable || dest.id === cityId) continue;
    const route = computeTravelRoute(cityId, dest.id, "train");
    if (!route) continue;
    const destDorm = dormDayPriceRub(dest.id);
    const totalRub = route.priceRub + destDorm;
    if (totalRub >= bestTotal) continue;
    bestTotal = totalRub;
    travelAdvice = {
      cityId: dest.id,
      cityName: dest.name,
      ticketRub: route.priceRub,
      dormDayRub: destDorm,
      totalRub,
      savingsRub: needRub - totalRub,
      localEarnShifts: shiftsToAffordRub(needRub),
      travelEarnShifts: shiftsToAffordRub(Math.max(0, totalRub - player.rubles)),
      travelDurationMs: route.durationMs,
    };
  }

  if (travelAdvice && travelAdvice.totalRub >= needRub) {
    travelAdvice = null;
  }

  return {
    cityName: city?.name ?? cityId,
    dormDayRub,
    rubles: player.rubles,
    needRub,
    loaderPayoutRub: LOADER_PAYOUT_RUB,
    shiftsToDorm: shiftsToAffordRub(needRub),
    travelAdvice,
  };
}

export function buildEmergencyLoaderJob(_cityId: string): JobDef {
  return {
    id: LOADER_JOB_ID,
    templateKey: LOADER_TEMPLATE_KEY,
    title: "Грузчик",
    kind: "cooldown",
    cooldownMs: LOADER_COOLDOWN_MS,
    payoutMin: LOADER_PAYOUT_RUB,
    payoutMax: LOADER_PAYOUT_RUB,
    skill: "stamina",
  };
}

export function resolveEmergencyLoaderJob(cityId: string, jobId: string): JobDef | undefined {
  if (!isEmergencyLoaderJobId(jobId)) return undefined;
  return buildEmergencyLoaderJob(cityId);
}
