import type { EventEffectType, RolledEffect } from "./cityEventsCatalog.js";
import { collectActiveEffects, getCityEventState } from "./cityEventsEngine.js";

export type CityEffectMod = { totalPct: number; hints: string[] };
export type CityFlatMod = { total: number; hints: string[] };

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

function formatFlatHint(value: number, title: string): string {
  const sign = value >= 0 ? "+" : "";
  const display = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
  return `${sign}${display} — ${title}`;
}

function formatMultDelta(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded.toFixed(1).replace(/\.0$/, "");
}

type EffectContribution = { value: number; source: string };

function weatherAmplifyMultiplier(state: ReturnType<typeof getCityEventState>): number {
  return state.events.flatMap((e) => e.effects).find((e) => e.type === "weatherAmplify")?.value ?? 1;
}

/** Вклады активных событий и погоды по типам эффектов. */
function listEffectContributions(
  cityId: string,
  types: EventEffectType[],
  now: number,
  opts?: { includeWeather?: boolean },
): EffectContribution[] {
  const state = getCityEventState(cityId, now);
  const out: EffectContribution[] = [];
  for (const ev of state.events) {
    for (const fx of ev.effects) {
      if (types.includes(fx.type)) out.push({ value: fx.value, source: ev.title });
    }
  }
  if (opts?.includeWeather !== false) {
    const amplify = weatherAmplifyMultiplier(state);
    for (const fx of state.weather.effects ?? []) {
      if (!types.includes(fx.type)) continue;
      const value = amplify !== 1 ? Math.round(fx.value * amplify * 10) / 10 : fx.value;
      out.push({ value, source: state.weather.label });
    }
  }
  return out;
}

function sumPctModifiers(
  cityId: string,
  types: EventEffectType[],
  now = Date.now(),
  opts?: { includeWeather?: boolean },
): CityEffectMod {
  const contributions = listEffectContributions(cityId, types, now, opts);
  let totalPct = 0;
  const hints: string[] = [];
  for (const c of contributions) {
    totalPct += c.value;
    hints.push(formatPctHint(c.value, c.source));
  }
  return { totalPct: Math.round(totalPct * 10) / 10, hints };
}

function sumFlatModifiers(
  cityId: string,
  types: EventEffectType[],
  now = Date.now(),
): CityFlatMod {
  const contributions = listEffectContributions(cityId, types, now);
  let total = 0;
  const hints: string[] = [];
  for (const c of contributions) {
    total += c.value;
    hints.push(formatFlatHint(c.value, c.source));
  }
  return { total: Math.round(total), hints };
}

export function applyPriceWithCityEvents(
  base: number,
  cityId: string,
  types: EventEffectType[],
  now = Date.now(),
  opts?: { includeWeather?: boolean },
): { value: number; totalPct: number; hints: string[] } {
  const mod = sumPctModifiers(cityId, types, now, opts);
  return {
    value: applyPercentModifier(base, mod.totalPct),
    totalPct: mod.totalPct,
    hints: mod.hints,
  };
}

/** Подсказки и суммарный % из активных событий города для зарплаты работы. */
export function jobSalaryModifier(
  cityId: string,
  templateKey: string,
  now = Date.now(),
): CityEffectMod {
  const types = jobSalaryEffectTypes(templateKey);
  return sumPctModifiers(cityId, types, now, { includeWeather: false });
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

export function getCityEffects(cityId: string, now = Date.now()): RolledEffect[] {
  return collectActiveEffects(getCityEventState(cityId, now));
}

export function usedCarLotsModifier(cityId: string, now = Date.now()): CityEffectMod {
  return sumPctModifiers(cityId, ["usedCarLots"], now, { includeWeather: false });
}

export function applyUsedCarLotsCount(baseCount: number, totalPct: number): number {
  if (!totalPct) return baseCount;
  return Math.max(1, Math.round(baseCount * (1 + totalPct / 100)));
}

export function fuelPriceModifier(cityId: string, now = Date.now()): CityEffectMod {
  return sumPctModifiers(cityId, ["fuelPrice"], now, { includeWeather: false });
}

export function housingRentModifier(cityId: string, now = Date.now()): CityEffectMod {
  return sumPctModifiers(cityId, ["housingRent"], now, { includeWeather: false });
}

export function newCarPriceModifier(cityId: string, now = Date.now()): CityEffectMod {
  return sumPctModifiers(cityId, ["newCarPrice", "autoDemand"], now, { includeWeather: false });
}

export function educationCostModifier(cityId: string, now = Date.now()): CityEffectMod {
  const cost = sumPctModifiers(cityId, ["educationCost"], now, { includeWeather: false });
  const grant = sumPctModifiers(cityId, ["educationGrant"], now, { includeWeather: false });
  const grantHints = grant.hints.map((h) => {
    const m = h.match(/^([+-][\d.]+)% — (.+)$/);
    if (!m) return h;
    const val = m[1]!.startsWith("+") ? m[1]!.replace("+", "−") : m[1]!.replace("−", "+");
    return `${val}% — ${m[2]}`;
  });
  return {
    totalPct: Math.round((cost.totalPct - grant.totalPct) * 10) / 10,
    hints: [...cost.hints, ...grantHints],
  };
}

export function cityMoodEventBonus(cityId: string, now = Date.now()): CityFlatMod {
  return sumFlatModifiers(cityId, ["mood"], now);
}

export function movementSpeedModifier(cityId: string, now = Date.now()): CityEffectMod {
  return sumPctModifiers(cityId, ["movementSpeed"], now);
}

export function taxiSpeedModifier(cityId: string, now = Date.now()): CityEffectMod {
  return sumPctModifiers(cityId, ["taxiSpeed"], now);
}

export function energyCostModifier(cityId: string, now = Date.now()): CityEffectMod {
  return sumPctModifiers(cityId, ["energyCost"], now, { includeWeather: false });
}

export function workReputationModifier(cityId: string, now = Date.now()): CityEffectMod {
  return sumPctModifiers(cityId, ["workReputation"], now, { includeWeather: false });
}

export function educationReputationModifier(cityId: string, now = Date.now()): CityEffectMod {
  return sumPctModifiers(cityId, ["educationReputation"], now, { includeWeather: false });
}

export function deliveryOrdersModifier(cityId: string, now = Date.now()): CityEffectMod {
  return sumPctModifiers(cityId, ["deliveryOrders"], now, { includeWeather: false });
}

export function rentalDemandModifier(cityId: string, now = Date.now()): CityEffectMod {
  return sumPctModifiers(cityId, ["rentalDemand"], now, { includeWeather: false });
}

/** Множитель длительности при изменении скорости (отрицательный % = дольше в пути). */
export function travelDurationMultiplier(speedPct: number): number {
  if (!speedPct) return 1;
  const speedFactor = 1 + speedPct / 100;
  if (speedFactor <= 0.05) return 20;
  return 1 / speedFactor;
}

export function applyTravelDurationMs(baseMs: number, cityId: string, now = Date.now()): number {
  const { totalPct } = movementSpeedModifier(cityId, now);
  return Math.max(60_000, Math.round(baseMs * travelDurationMultiplier(totalPct)));
}

export function applyTaxiSpeedMinPerKm(baseMinPerKm: number, cityId: string, now = Date.now()): number {
  const { totalPct } = taxiSpeedModifier(cityId, now);
  if (!totalPct) return baseMinPerKm;
  const speedFactor = 1 + totalPct / 100;
  if (speedFactor <= 0.05) return baseMinPerKm * 20;
  return Math.max(0.5, Math.round((baseMinPerKm / speedFactor) * 10) / 10);
}

export function applyWorkReputationGain(baseGain: number, cityId: string, now = Date.now()): number {
  const { totalPct } = workReputationModifier(cityId, now);
  return Math.max(0, Math.round(baseGain * (1 + totalPct / 100)));
}
