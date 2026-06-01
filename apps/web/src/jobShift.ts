import type { CityLocalTime } from "./cityTime";
import { formatDuration } from "./formatDuration";

const NIGHT_GUARD_NIGHT_START = 22;
const NIGHT_GUARD_SHIFT_END = 8;
const NIGHT_GUARD_PERIOD_MINUTES = (24 - NIGHT_GUARD_NIGHT_START + NIGHT_GUARD_SHIFT_END) * 60;

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

export function nightGuardStaminaEligible(
  local: Pick<CityLocalTime, "hour" | "minute">,
  shiftEndHour = NIGHT_GUARD_SHIFT_END,
): boolean {
  const shiftMinutes = computeNightGuardShiftMinutes(local.hour, local.minute, shiftEndHour);
  return shiftMinutes > NIGHT_GUARD_PERIOD_MINUTES / 2;
}

export function formatShiftMinutesRu(totalMinutes: number): string {
  return formatDuration(Math.max(0, totalMinutes) * 60_000);
}

/** Длительность рабочей смены (для подтверждения выхода на работу). */
export function getShiftDurationLabel(
  job: {
    kind: string;
    templateKey?: string;
    shiftHoursMin?: number | null;
    shiftHoursMax?: number | null;
    shiftHours?: number | null;
    shiftEndsAtHour?: number | null;
  },
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
  job: {
    kind: string;
    shiftHoursMin?: number | null;
    shiftHoursMax?: number | null;
    shiftHours?: number | null;
    cooldownMs?: number;
  },
  opts?: {
    remainingMs?: number;
    lastShiftHours?: number | null;
    selectedShiftHours?: number;
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
  if (job.shiftHours != null && job.shiftHours > 0) return `${job.shiftHours} ч`;
  const ms = job.cooldownMs ?? 0;
  if (ms > 0) return formatDuration(ms);
  return "—";
}

export function nightGuardStaminaHint(): string {
  return "если вышли до 3:00";
}
