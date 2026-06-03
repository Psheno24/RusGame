import type { CityLocalTime } from "./cityTime.js";
import { getCityLocalTime } from "./cityTime.js";
import { formatDuration } from "./formatDuration.js";
import type { JobDef } from "./gameData.js";

const HOUR_MS = 3_600_000;
const MIN_MS = 60_000;
const NIGHT_GUARD_NIGHT_START = 22;
const NIGHT_GUARD_SHIFT_END = 8;
export const NIGHT_GUARD_PERIOD_MINUTES = (24 - NIGHT_GUARD_NIGHT_START + NIGHT_GUARD_SHIFT_END) * 60;
export const NIGHT_GUARD_MAX_SHIFT_HOURS = NIGHT_GUARD_PERIOD_MINUTES / 60;

/** КД после смены: для фиксированной смены (кассир) — из shiftHours; для сторожа — до 8:00. */
export function jobNominalCooldownMs(
  job: Pick<JobDef, "kind" | "shiftHoursMin" | "shiftHours" | "shiftEndsAtHour" | "cooldownMs">,
  local?: Pick<CityLocalTime, "hour" | "minute">,
): number {
  if (job.kind === "duration") return (job.shiftHoursMin ?? 4) * HOUR_MS;
  if (job.shiftHours != null && job.shiftHours > 0) return job.shiftHours * HOUR_MS;
  if (job.shiftEndsAtHour != null && local) {
    return computeNightGuardShiftMinutes(local.hour, local.minute, job.shiftEndsAtHour) * MIN_MS;
  }
  if (job.shiftEndsAtHour != null) return NIGHT_GUARD_PERIOD_MINUTES * MIN_MS;
  return job.cooldownMs ?? 0;
}

export function computeNightGuardShiftMs(
  local: Pick<CityLocalTime, "hour" | "minute">,
  shiftEndHour = NIGHT_GUARD_SHIFT_END,
): number {
  return computeNightGuardShiftMinutes(local.hour, local.minute, shiftEndHour) * MIN_MS;
}

/** Длительность смены сторожа в момент выхода на работу (по timestamp и часовому поясу города). */
export function nightGuardCooldownMsAtWork(
  workAtMs: number,
  timezone: string,
  shiftEndHour = NIGHT_GUARD_SHIFT_END,
): number {
  const local = getCityLocalTime(timezone, workAtMs);
  return computeNightGuardShiftMs(local, shiftEndHour);
}

export function scaleNightGuardPayoutRange(
  payoutMin: number,
  payoutMax: number,
  shiftHours: number,
): { min: number; max: number } {
  const proportion = Math.min(1, shiftHours / NIGHT_GUARD_MAX_SHIFT_HOURS);
  return {
    min: Math.floor(payoutMin * proportion),
    max: Math.floor(payoutMax * proportion),
  };
}

/** Диапазон зарплаты в карточке работы: минимум при выходе в 7:59, максимум при выходе в 22:00. */
export function nightGuardDisplayPayoutRange(
  payoutMin: number,
  payoutMax: number,
  shiftEndHour = NIGHT_GUARD_SHIFT_END,
): { min: number; max: number } {
  const minShiftHours =
    computeNightGuardShiftMinutes(7, 59, shiftEndHour) / 60;
  const maxShiftHours =
    computeNightGuardShiftMinutes(NIGHT_GUARD_NIGHT_START, 0, shiftEndHour) / 60;
  const atLatest = scaleNightGuardPayoutRange(payoutMin, payoutMax, minShiftHours);
  const atEarliest = scaleNightGuardPayoutRange(payoutMin, payoutMax, maxShiftHours);
  return { min: atLatest.min, max: atEarliest.max };
}

export function computeNightGuardShiftMinutes(
  hour: number,
  minute: number,
  shiftEndHour = NIGHT_GUARD_SHIFT_END,
): number {
  const nowMin = hour * 60 + minute;
  const endMin = shiftEndHour * 60;
  if (nowMin < endMin) return endMin - nowMin;
  if (hour >= NIGHT_GUARD_NIGHT_START) return 24 * 60 - nowMin + endMin;
  return 0;
}

export function computeNightGuardShiftHours(local: CityLocalTime, shiftEndHour = NIGHT_GUARD_SHIFT_END): number {
  return computeNightGuardShiftMinutes(local.hour, local.minute, shiftEndHour) / 60;
}

/** Stamina if more than half of the 22:00–8:00 window remains (start before 3:00). */
export function nightGuardStaminaEligible(
  local: CityLocalTime,
  shiftEndHour = NIGHT_GUARD_SHIFT_END,
): boolean {
  const shiftMinutes = computeNightGuardShiftMinutes(local.hour, local.minute, shiftEndHour);
  return shiftMinutes > NIGHT_GUARD_PERIOD_MINUTES / 2;
}

export function formatShiftMinutesRu(totalMinutes: number): string {
  return formatDuration(Math.max(0, totalMinutes) * 60_000);
}

export function isNightGuardJob(job: Pick<JobDef, "templateKey" | "shiftEndsAtHour">): boolean {
  return job.templateKey === "night_guard" || job.shiftEndsAtHour != null;
}

/** Длительность рабочей смены (для подтверждения выхода на работу). */
export function getShiftDurationLabel(
  job: Pick<JobDef, "kind" | "shiftHoursMin" | "shiftHoursMax" | "shiftHours" | "shiftEndsAtHour">,
  local?: Pick<CityLocalTime, "hour" | "minute">,
): string {
  if (job.kind === "duration") {
    const min = job.shiftHoursMin ?? 4;
    const max = job.shiftHoursMax ?? 12;
    return `${min}–${max} ч`;
  }
  if (job.shiftEndsAtHour != null) {
    const end = String(job.shiftEndsAtHour).padStart(2, "0");
    if (local) {
      const mins = computeNightGuardShiftMinutes(local.hour, local.minute, job.shiftEndsAtHour);
      if (mins > 0) return `до ${end}:00 (${formatShiftMinutesRu(mins)})`;
    }
    return `до ${end}:00`;
  }
  if (job.shiftHours != null) return `${job.shiftHours} ч`;
  return "—";
}

/** КД смены — совпадает с таймером на кнопках «Выйти на смену» / «Уволиться». */
export function getJobCooldownLabel(
  job: Pick<
    JobDef,
    "kind" | "shiftHoursMin" | "shiftHoursMax" | "shiftHours" | "shiftEndsAtHour" | "cooldownMs"
  >,
  opts?: {
    remainingMs?: number;
    lastShiftHours?: number | null;
    selectedShiftHours?: number;
    local?: Pick<CityLocalTime, "hour" | "minute">;
  },
): string {
  if (opts?.remainingMs != null && opts.remainingMs > 0) {
    return formatDuration(opts.remainingMs);
  }
  if (job.kind === "duration") {
    if (opts?.selectedShiftHours != null) return `${opts.selectedShiftHours} ч`;
    if (opts?.lastShiftHours != null) return `${opts.lastShiftHours} ч`;
    const min = job.shiftHoursMin ?? 4;
    const max = job.shiftHoursMax ?? 12;
    return `${min}–${max} ч`;
  }
  if (job.shiftEndsAtHour != null) {
    return getShiftDurationLabel(job, opts?.local);
  }
  if (job.shiftHours != null && job.shiftHours > 0) return `${job.shiftHours} ч`;
  const ms = job.cooldownMs ?? 0;
  if (ms > 0) return formatDuration(ms);
  return "—";
}

export function nightGuardStaminaHint(): string {
  return "если вышли до 3:00";
}
