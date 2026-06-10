import { getCityLocalTime } from "./cityTime.js";
import { getCity } from "./gameData.js";
import { collectActiveEffects, getCityEventState } from "./cityEventsEngine.js";
import type { RolledEffect } from "./cityEventsCatalog.js";
import { lineIncomeHints } from "./cityEffectModifiers.js";

const BUSINESS_TARIFFS = new Set(["business", "premium"]);

/** Российские государственные праздники (месяц-день в локальном времени города). */
const FIXED_HOLIDAYS: [number, number][] = [
  [1, 1],
  [1, 2],
  [1, 3],
  [1, 4],
  [1, 5],
  [1, 6],
  [1, 7],
  [1, 8],
  [2, 23],
  [3, 8],
  [5, 1],
  [5, 9],
  [6, 12],
  [11, 4],
];

function readLocalDate(timezone: string, now: number): { month: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(new Date(now));
  const month = Number(parts.find((p) => p.type === "month")?.value ?? 1);
  const day = Number(parts.find((p) => p.type === "day")?.value ?? 1);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { month, day, weekday: weekdayMap[wd] ?? 1 };
}

export function isWeekend(timezone: string, now: number): boolean {
  const { weekday } = readLocalDate(timezone, now);
  return weekday === 0 || weekday === 6;
}

export function isFixedHoliday(timezone: string, now: number): boolean {
  const { month, day } = readLocalDate(timezone, now);
  return FIXED_HOLIDAYS.some(([m, d]) => m === month && d === day);
}

export function isEvening(hour: number): boolean {
  return hour >= 18 && hour <= 23;
}

export type IncomeMultiplierBreakdown = {
  total: number;
  base: number;
  evening: number;
  calendar: number;
  events: number;
  isEvening: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  hints: string[];
};

function sumEffectValues(
  effects: RolledEffect[],
  types: RolledEffect["type"][],
): number {
  return effects
    .filter((e) => types.includes(e.type))
    .reduce((s, e) => s + e.value, 0);
}

function getCalendarBonus(timezone: string, now: number, cityHoliday: boolean): number {
  const weekend = isWeekend(timezone, now);
  const holiday = isFixedHoliday(timezone, now) || cityHoliday;
  if (weekend || holiday) return 0.3;
  return 0;
}

/** Расчёт коэффициента по составным частям (для тестов и API). */
export function computeIncomeMultiplier(
  localHour: number,
  timezone: string,
  now: number,
  effects: RolledEffect[],
  cityHoliday: boolean,
  opts?: { taxiClass?: string | null; mode?: "taxi" | "delivery" },
): IncomeMultiplierBreakdown {
  const base = 1.0;
  const eveningBonus = isEvening(localHour) ? 0.2 : 0;
  const calendarBonus = getCalendarBonus(timezone, now, cityHoliday);

  let eventBonus = 0;
  const mode = opts?.mode ?? "taxi";
  const taxiClass = opts?.taxiClass ?? null;

  if (mode === "taxi") {
    eventBonus += sumEffectValues(effects, ["taxiDemand"]);
    if (taxiClass && BUSINESS_TARIFFS.has(taxiClass)) {
      eventBonus += sumEffectValues(effects, ["taxiBusinessPremium"]);
    }
  } else {
    eventBonus += sumEffectValues(effects, ["deliveryDemand"]);
  }

  const total = base + eveningBonus + calendarBonus + eventBonus;

  return {
    total: Math.round(total * 100) / 100,
    base,
    evening: eveningBonus,
    calendar: calendarBonus,
    events: Math.round(eventBonus * 100) / 100,
    isEvening: eveningBonus > 0,
    isWeekend: isWeekend(timezone, now),
    isHoliday: isFixedHoliday(timezone, now) || cityHoliday,
    hints: [],
  };
}

/** Общий коэффициент дохода (аддитивный: 1.0 + бонусы). */
export function getIncomeMultiplierBreakdown(
  cityId: string,
  now = Date.now(),
  opts?: { taxiClass?: string | null; mode?: "taxi" | "delivery" },
): IncomeMultiplierBreakdown {
  const tz = getCity(cityId)?.timezone ?? "Europe/Moscow";
  const local = getCityLocalTime(tz, now);
  const state = getCityEventState(cityId, now);
  const effects = collectActiveEffects(state);

  const bd = computeIncomeMultiplier(
    local.hour,
    tz,
    now,
    effects,
    state.hasCityHoliday,
    opts,
  );

  return {
    ...bd,
    hints: lineIncomeHints(cityId, now, {
      mode: opts?.mode ?? "taxi",
      taxiClass: opts?.taxiClass ?? null,
      evening: bd.evening,
      calendar: bd.calendar,
      isHoliday: bd.isHoliday,
    }),
  };
}

export function getTaxiIncomeMultiplier(
  cityId: string,
  taxiClass: string | null | undefined,
  now = Date.now(),
): number {
  return getIncomeMultiplierBreakdown(cityId, now, { mode: "taxi", taxiClass }).total;
}

export function getDeliveryIncomeMultiplier(cityId: string, now = Date.now()): number {
  return getIncomeMultiplierBreakdown(cityId, now, { mode: "delivery" }).total;
}

export function formatIncomeMultiplier(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `×${rounded.toFixed(1).replace(/\.0$/, "")}`;
}

export function formatRefreshCountdown(remainingMs: number): string {
  const totalMin = Math.max(0, Math.ceil(remainingMs / 60_000));
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0) return `${hours} ч ${mins} мин`;
  return `${mins} мин`;
}
