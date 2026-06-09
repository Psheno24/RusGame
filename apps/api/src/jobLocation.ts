import type { PlayerRow } from "./db.js";
import { findCityJob, getCities, getCity } from "./gameData.js";
import {
  isEmergencyLoaderJob,
  isEmergencyLoaderJobId,
  shouldOfferEmergencyLoader,
} from "./emergencyLoader.js";
import { educationBlockMessage, educationBlocksMainWork } from "./education.js";
import { isCityResident } from "./housing.js";

export function jobCityId(jobId: string): string | null {
  if (isEmergencyLoaderJobId(jobId)) {
    if (jobId.endsWith("_loader") && jobId !== "loader") {
      return jobId.slice(0, -"_loader".length);
    }
    return null;
  }
  for (const c of getCities()) {
    if (findCityJob(c.id, jobId)) return c.id;
  }
  return null;
}

export function workCityIdForPlayer(player: PlayerRow, jobId: string): string | null {
  if (isEmergencyLoaderJobId(jobId)) return player.city_id;
  return jobCityId(jobId);
}

export function jobAccessStatus(player: PlayerRow, jobId: string, now = Date.now()) {
  const workCityId = workCityIdForPlayer(player, jobId);
  if (!workCityId) {
    return {
      workCityId: null as string | null,
      workCityName: null as string | null,
      physicallyHere: false,
      residentHere: false,
      error: "Вакансия не найдена",
    };
  }
  const city = getCity(workCityId);
  const job = findCityJob(workCityId, jobId);
  if (job && isEmergencyLoaderJob(job)) {
    if (!shouldOfferEmergencyLoader(player, now)) {
      return {
        workCityId,
        workCityName: city?.name ?? workCityId,
        physicallyHere: true,
        residentHere: true,
        error: "Подработка «Грузчик» недоступна",
      };
    }
    return {
      workCityId,
      workCityName: city?.name ?? workCityId,
      physicallyHere: true,
      residentHere: true,
      error: null,
    };
  }
  const physicallyHere = player.city_id === workCityId;
  const residentHere = isCityResident(player, workCityId, now);
  let error: string | null = null;
  if (educationBlocksMainWork(player, jobId)) {
    error = educationBlockMessage();
  } else if (!physicallyHere) {
    error = `Работа в ${city?.name ?? workCityId}: вы сейчас в другом городе`;
  } else if (!residentHere) {
    error = `Для работы нужно жить в ${city?.name ?? workCityId}`;
  }
  return {
    workCityId,
    workCityName: city?.name ?? workCityId,
    physicallyHere,
    residentHere,
    error,
  };
}

export function validateJobWorkAccess(player: PlayerRow, jobId: string, now = Date.now()): string | null {
  return jobAccessStatus(player, jobId, now).error;
}
