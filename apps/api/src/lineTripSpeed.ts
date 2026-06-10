import { applyTaxiSpeedMinPerKm } from "./cityEffectModifiers.js";
import { randInt } from "./random.js";

export type AutoTrafficKey = "free" | "normal" | "jam";

export type AutoTrafficBand = {
  weight: number;
  speedMinPerKm: number;
  speedMaxPerKm: number;
};

export type AutoTrafficConfig = Record<AutoTrafficKey, AutoTrafficBand>;

export const AUTO_TRAFFIC_TITLES: Record<AutoTrafficKey, string> = {
  free: "Свободная дорога",
  normal: "Обычное движение",
  jam: "Пробка",
};

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1]!;
}

function rollInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Случайная скорость (мин/км) для пеших и лёгкого транспорта — без пробок. */
export function rollUniformSpeedMinPerKm(speedMin: number, speedMax: number): number {
  return Math.round(rollInRange(speedMin, speedMax) * 10) / 10;
}

/** Пробки и свободная дорога — только для авто (доставка на машине, такси). */
export function rollAutoTrafficSpeed(
  traffic: AutoTrafficConfig,
  cityId?: string,
  now = Date.now(),
): { minPerKm: number; trafficKey: AutoTrafficKey; trafficTitle: string } {
  const bands = Object.entries(traffic) as [AutoTrafficKey, AutoTrafficBand][];
  const picked = pickWeighted(bands.map(([, b]) => b));
  const key = bands.find(([, b]) => b === picked)![0];
  let minPerKm = rollInRange(picked.speedMinPerKm, picked.speedMaxPerKm);
  if (cityId) {
    minPerKm = applyTaxiSpeedMinPerKm(minPerKm, cityId, now);
  }
  minPerKm = Math.round(minPerKm * 10) / 10;
  return { minPerKm, trafficKey: key, trafficTitle: AUTO_TRAFFIC_TITLES[key] };
}

export function tripMinutesFromKm(
  distanceKm: number,
  minPerKm: number,
  pickupMinutes = 0,
): number {
  return Math.max(1, pickupMinutes + Math.round(distanceKm * minPerKm));
}

/** Укоротить маршрут, если поездка превышает лимит минут (выплата пересчитывается по новым км). */
export function capTripByMaxMinutes(
  distanceKm: number,
  tripMinutes: number,
  maxTripMinutes: number,
): { distanceKm: number; tripMinutes: number } {
  if (tripMinutes <= maxTripMinutes) return { distanceKm, tripMinutes };
  const scale = maxTripMinutes / tripMinutes;
  return {
    tripMinutes: maxTripMinutes,
    distanceKm: Math.max(0.5, Math.round(distanceKm * scale * 10) / 10),
  };
}

export function rollDeliverySpeedMinPerKm(
  transport: string,
  speedMin: number,
  speedMax: number,
  autoTraffic: AutoTrafficConfig | undefined,
  cityId: string,
  now: number,
): { minPerKm: number; trafficKey?: AutoTrafficKey; trafficTitle?: string } {
  if (transport === "car" && autoTraffic) {
    const t = rollAutoTrafficSpeed(autoTraffic, cityId, now);
    return t;
  }
  return { minPerKm: rollUniformSpeedMinPerKm(speedMin, speedMax) };
}
