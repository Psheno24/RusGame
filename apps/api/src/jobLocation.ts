import type { PlayerRow } from "./db.js";
import { findCityJob, getCities, getCity } from "./gameData.js";
import { isCityResident } from "./housing.js";

export function jobCityId(jobId: string): string | null {
  for (const c of getCities()) {
    if (findCityJob(c.id, jobId)) return c.id;
  }
  return null;
}

export function jobAccessStatus(player: PlayerRow, jobId: string, now = Date.now()) {
  const workCityId = jobCityId(jobId);
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
  const physicallyHere = player.city_id === workCityId;
  const residentHere = isCityResident(player, workCityId, now);
  let error: string | null = null;
  if (!physicallyHere) {
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
