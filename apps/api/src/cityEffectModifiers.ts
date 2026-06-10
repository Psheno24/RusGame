import type { EventEffectType, RolledEffect } from "./cityEventsCatalog.js";
import { collectActiveEffects, getCityEventState } from "./cityEventsEngine.js";

/** Процентные эффекты, суммируемые для зарплат подработок. */
const JOB_SALARY_EFFECTS: Partial<Record<string, EventEffectType[]>> = {
  cashier: ["cashierSalary", "workSalary"],
  night_guard: ["cashierSalary", "workSalary"],
  loader: ["workSalary"],
};

export function jobSalaryEffectTypes(templateKey: string): EventEffectType[] {
  return JOB_SALARY_EFFECTS[templateKey] ?? ["workSalary"];
}

export function applyPercentModifier(base: number, totalPct: number): number {
  if (!totalPct) return base;
  return Math.max(0, Math.round(base * (1 + totalPct / 100)));
}

function formatPctHint(value: number, title: string): string {
  const sign = value >= 0 ? "+" : "";
  const display = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
  return `${sign}${display}% — ${title}`;
}

/** Подсказки и суммарный % из активных событий города для зарплаты работы. */
export function jobSalaryModifier(
  cityId: string,
  templateKey: string,
  now = Date.now(),
): { totalPct: number; hints: string[] } {
  const state = getCityEventState(cityId, now);
  const types = jobSalaryEffectTypes(templateKey);
  const hints: string[] = [];
  let totalPct = 0;

  for (const ev of state.events) {
    for (const fx of ev.effects) {
      if (!types.includes(fx.type)) continue;
      totalPct += fx.value;
      hints.push(formatPctHint(fx.value, ev.title));
    }
  }

  return { totalPct: Math.round(totalPct * 10) / 10, hints };
}

export function applyJobSalaryRange(
  cityId: string,
  templateKey: string,
  min: number,
  max: number,
  now = Date.now(),
): { min: number; max: number; hints: string[]; totalPct: number } {
  const mod = jobSalaryModifier(cityId, templateKey, now);
  return {
    min: applyPercentModifier(min, mod.totalPct),
    max: applyPercentModifier(max, mod.totalPct),
    hints: mod.hints,
    totalPct: mod.totalPct,
  };
}

/** Подсказки для аддитивного коэффициента дохода (такси / курьер). */
export function lineIncomeHints(
  cityId: string,
  now: number,
  opts: {
    mode: "taxi" | "delivery";
    taxiClass?: string | null;
    evening: number;
    calendar: number;
    isHoliday: boolean;
  },
): string[] {
  const state = getCityEventState(cityId, now);
  const hints: string[] = [];

  if (opts.evening > 0) hints.push(`+${formatMultDelta(opts.evening)} — вечер`);
  if (opts.calendar > 0) {
    hints.push(`+${formatMultDelta(opts.calendar)} — ${opts.isHoliday ? "праздник" : "выходной"}`);
  }

  const business = opts.taxiClass != null && ["business", "premium"].includes(opts.taxiClass);
  for (const ev of state.events) {
    for (const fx of ev.effects) {
      if (opts.mode === "taxi") {
        if (fx.type === "taxiDemand") {
          hints.push(`+${formatMultDelta(fx.value)} — ${ev.title}`);
        } else if (fx.type === "taxiBusinessPremium" && business) {
          hints.push(`+${formatMultDelta(fx.value)} — ${ev.title}`);
        }
      } else if (opts.mode === "delivery" && fx.type === "deliveryDemand") {
        hints.push(`${fx.value >= 0 ? "+" : ""}${formatMultDelta(fx.value)} — ${ev.title}`);
      }
    }
  }

  return hints;
}

function formatMultDelta(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded.toFixed(1).replace(/\.0$/, "");
}

export function getCityEffects(cityId: string, now = Date.now()): RolledEffect[] {
  return collectActiveEffects(getCityEventState(cityId, now));
}

/** Суммарный % к числу лотов на б/у рынке из активных событий города. */
export function usedCarLotsModifier(
  cityId: string,
  now = Date.now(),
): { totalPct: number; hints: string[] } {
  const state = getCityEventState(cityId, now);
  const hints: string[] = [];
  let totalPct = 0;

  for (const ev of state.events) {
    for (const fx of ev.effects) {
      if (fx.type !== "usedCarLots") continue;
      totalPct += fx.value;
      hints.push(formatPctHint(fx.value, ev.title));
    }
  }

  return { totalPct: Math.round(totalPct * 10) / 10, hints };
}

export function applyUsedCarLotsCount(baseCount: number, totalPct: number): number {
  if (!totalPct) return baseCount;
  return Math.max(1, Math.round(baseCount * (1 + totalPct / 100)));
}
