export type TimeOfDayPeriod = "morning" | "day" | "evening" | "night";

export type CityLocalTime = {
  hour: number;
  minute: number;
  minutesOfDay: number;
  label: string;
  period: TimeOfDayPeriod;
  periodLabel: string;
};

export type JobSchedule = {
  mode: "any" | "day" | "night";
  dayStartHour?: number;
  nightStartHour?: number;
};

const PERIOD_LABELS: Record<TimeOfDayPeriod, string> = {
  morning: "Утро",
  day: "День",
  evening: "Вечер",
  night: "Ночь",
};

export const DEFAULT_TIMEZONE = "Europe/Moscow";

function readLocalParts(timezone: string, now: number): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(now));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { hour, minute };
}

export function getTimeOfDayPeriod(hour: number): TimeOfDayPeriod {
  if (hour >= 6 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 17) return "day";
  if (hour >= 18 && hour <= 21) return "evening";
  return "night";
}

export function getCityLocalTime(timezone: string, now = Date.now()): CityLocalTime {
  const { hour, minute } = readLocalParts(timezone, now);
  const period = getTimeOfDayPeriod(hour);
  return {
    hour,
    minute,
    minutesOfDay: hour * 60 + minute,
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

export function isWorkScheduleAllowed(
  localTime: CityLocalTime,
  schedule?: JobSchedule,
): boolean {
  if (!schedule || schedule.mode === "any") return true;
  if (schedule.mode === "day") return isDayTime(localTime.minutesOfDay, schedule);
  if (schedule.mode === "night") return !isDayTime(localTime.minutesOfDay, schedule);
  return true;
}
