import type { JobSchedule } from "./gameData.js";

export type TimeOfDayPeriod = "morning" | "day" | "evening" | "night";

export type CityLocalTime = {
  hour: number;
  minute: number;
  minutesOfDay: number;
  label: string;
  period: TimeOfDayPeriod;
  periodLabel: string;
};

export type PayoutPeriod = {
  fromHour: number;
  toHour: number;
  multiplier: number;
};

const PERIOD_LABELS: Record<TimeOfDayPeriod, string> = {
  morning: "Утро",
  day: "День",
  evening: "Вечер",
  night: "Ночь",
};

export const DEFAULT_TIMEZONE = "Europe/Moscow";

export function getCityTimezone(city: { timezone?: string } | undefined): string {
  return city?.timezone?.trim() || DEFAULT_TIMEZONE;
}

function readLocalParts(timezone: string, now: number): { hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(now));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const second = Number(parts.find((p) => p.type === "second")?.value ?? 0);
  return { hour, minute, second };
}

/** Миллисекунды от начала текущего часа (локальное время). */
export function getLocalMsIntoHour(timezone: string, now = Date.now()): number {
  const { minute, second } = readLocalParts(timezone, now);
  return minute * 60_000 + second * 1000 + (now % 1000);
}

/** Миллисекунды от начала текущего 3-часового слота (локальное время). */
export function getLocalMsIntoEventSlot(timezone: string, now = Date.now()): number {
  const { hour, minute, second } = readLocalParts(timezone, now);
  const slotHour = Math.floor(hour / 3) * 3;
  const minutesOfDay = hour * 60 + minute;
  return (minutesOfDay - slotHour * 60) * 60_000 + second * 1000 + (now % 1000);
}

export function getTimeOfDayPeriod(hour: number): TimeOfDayPeriod {
  if (hour >= 6 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 17) return "day";
  if (hour >= 18 && hour <= 21) return "evening";
  return "night";
}

export function getCityLocalTime(timezone: string, now = Date.now()): CityLocalTime {
  const { hour, minute } = readLocalParts(timezone, now);
  const minutesOfDay = hour * 60 + minute;
  const period = getTimeOfDayPeriod(hour);
  return {
    hour,
    minute,
    minutesOfDay,
    label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    period,
    periodLabel: PERIOD_LABELS[period],
  };
}

export function isDayTime(minutesOfDay: number, schedule: JobSchedule): boolean {
  const dayStart = (schedule.dayStartHour ?? 6) * 60;
  const nightStart = (schedule.nightStartHour ?? 22) * 60;
  return minutesOfDay >= dayStart && minutesOfDay < nightStart;
}

export function isNightTime(minutesOfDay: number, schedule: JobSchedule): boolean {
  return !isDayTime(minutesOfDay, schedule);
}

export function isWorkScheduleAllowed(localTime: CityLocalTime, schedule?: JobSchedule): boolean {
  if (!schedule || schedule.mode === "any") return true;
  if (schedule.mode === "day") return isDayTime(localTime.minutesOfDay, schedule);
  if (schedule.mode === "night") return isNightTime(localTime.minutesOfDay, schedule);
  return true;
}

export function scheduleBlockedMessage(localTime: CityLocalTime, schedule: JobSchedule): string {
  const nightStart = schedule.nightStartHour ?? 22;
  const dayStart = schedule.dayStartHour ?? 6;
  if (schedule.mode === "night") {
    return `Смена с ${nightStart}:00 до ${dayStart}:00. Сейчас в городе ${localTime.label}`;
  }
  return `Работа только днём (${dayStart}:00–${nightStart}:00). Сейчас в городе ${localTime.label}`;
}

export function isHourInRange(hour: number, fromHour: number, toHour: number): boolean {
  if (fromHour === toHour) return false;
  if (fromHour < toHour) return hour >= fromHour && hour < toHour;
  return hour >= fromHour || hour < toHour;
}

export function getPayoutMultiplier(hour: number, periods?: PayoutPeriod[]): number {
  if (!periods?.length) return 1;
  for (const p of periods) {
    if (isHourInRange(hour, p.fromHour, p.toHour)) return p.multiplier;
  }
  return 1;
}

export function getNextScheduleWindowAt(
  timezone: string,
  schedule: JobSchedule,
  now = Date.now(),
): string | null {
  if (!schedule || schedule.mode === "any") return null;
  const local = getCityLocalTime(timezone, now);
  if (isWorkScheduleAllowed(local, schedule)) return null;

  const dayStart = schedule.dayStartHour ?? 6;
  const nightStart = schedule.nightStartHour ?? 22;
  const dayStartMin = dayStart * 60;
  const nightStartMin = nightStart * 60;

  let minutesUntil: number;
  if (schedule.mode === "night") {
    if (local.minutesOfDay >= dayStartMin && local.minutesOfDay < nightStartMin) {
      minutesUntil = nightStartMin - local.minutesOfDay;
    } else {
      return null;
    }
  } else {
    if (local.minutesOfDay >= nightStartMin) {
      minutesUntil = 24 * 60 - local.minutesOfDay + dayStartMin;
    } else {
      minutesUntil = dayStartMin - local.minutesOfDay;
    }
  }

  return new Date(now + minutesUntil * 60_000).toISOString();
}

export function enrichJobWorkState(
  timezone: string,
  job: { schedule?: JobSchedule; payoutPeriods?: PayoutPeriod[] },
  now = Date.now(),
) {
  const localTime = getCityLocalTime(timezone, now);
  const scheduleAllowed = isWorkScheduleAllowed(localTime, job.schedule);
  const payoutMultiplier = getPayoutMultiplier(localTime.hour, job.payoutPeriods);
  return {
    localTime,
    scheduleAllowed,
    payoutMultiplier,
    scheduleHint: !scheduleAllowed && job.schedule
      ? scheduleBlockedMessage(localTime, job.schedule)
      : payoutMultiplier !== 1
        ? `Коэффициент заказа ×${payoutMultiplier.toFixed(2).replace(/\.?0+$/, "")}`
        : null,
    nextWindowAt:
      !scheduleAllowed && job.schedule
        ? getNextScheduleWindowAt(timezone, job.schedule, now)
        : null,
  };
}
