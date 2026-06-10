import { randInt } from "./random.js";
import { getBalanceBible } from "./balanceBible.js";
import { applyTaxiSpeedMinPerKm } from "./cityEffectModifiers.js";

/** Кривая почасового дохода такси (legacy, для совместимости тестов). */
export type TaxiPayoutCurve = {
  tripMinutesMin: number;
  tripMinutesMax: number;
  midTripMinutes: number;
  hourlyAtMinTrip: number;
  hourlyAtMidTrip: number;
  hourlyAtMaxTrip: number;
};

export type TaxiCashRiskConfig = {
  cashNoPayBaseChance: number;
  cashPartialPayBaseChance: number;
  cashNoPayPerRatingBelow45: number;
  cashPartialPayPerRatingBelow45: number;
  cashPartialPayFraction: number;
  parkCompensationFraction: number;
};

type TaxiBible = {
  tariffPerKm: Record<string, number>;
  distanceBands: { minKm: number; maxKm: number; weight: number }[];
  demand: { key: string; mult: number; weight: number }[];
  pickupMinMin: number;
  pickupMaxMin: number;
  speedMinPerKm: { free: number; normal: number; peak: number };
};

function taxiBible(): TaxiBible {
  return getBalanceBible().taxi as TaxiBible;
}

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1]!;
}

export function rollTripKm(): number {
  const band = pickWeighted(taxiBible().distanceBands);
  return randInt(band.minKm * 10, band.maxKm * 10) / 10;
}

export function rollDemandMult(): { key: string; mult: number } {
  const d = pickWeighted(taxiBible().demand);
  return { key: d.key, mult: d.mult };
}

/** Время и дистанция заказа — как в Омске; город влияет только на ₽/км. */
export function rollTaxiOrderTrip(
  tripMinutesMin: number,
  tripMinutesMax: number,
  cityId?: string,
  now = Date.now(),
): {
  tripMinutes: number;
  distanceKm: number;
  demand: { key: string; mult: number };
} {
  const cfg = taxiBible();
  const tripMinutes = randInt(tripMinutesMin, tripMinutesMax);
  const pickup = randInt(cfg.pickupMinMin, Math.min(cfg.pickupMaxMin, tripMinutes - 1));
  const travelMin = tripMinutes - pickup;
  const demand = rollDemandMult();
  let speed =
    demand.key === "peak" || demand.key === "surge"
      ? cfg.speedMinPerKm.peak
      : cfg.speedMinPerKm.normal;
  if (cityId) speed = applyTaxiSpeedMinPerKm(speed, cityId, now);
  const distanceKm = Math.max(
    0.5,
    Math.round((travelMin / speed) * (randInt(90, 110) / 100) * 10) / 10,
  );
  return { tripMinutes, distanceKm, demand };
}

export function tripMinutesFromKm(km: number, demandKey: string): number {
  const cfg = taxiBible();
  const pickup = randInt(cfg.pickupMinMin, cfg.pickupMaxMin);
  const speed =
    demandKey === "peak" || demandKey === "surge"
      ? cfg.speedMinPerKm.peak
      : demandKey === "high"
        ? cfg.speedMinPerKm.normal
        : cfg.speedMinPerKm.normal;
  const travelMin = km * speed * randInt(90, 110) / 100;
  return Math.max(3, pickup + Math.round(travelMin));
}

/** Выплата: км × тариф × спрос × город. */
export function taxiKmPayoutRub(
  km: number,
  tariff: string,
  demandMult: number,
  cityMult: number,
): number {
  const rate = taxiBible().tariffPerKm[tariff] ?? taxiBible().tariffPerKm.economy ?? 220;
  return Math.max(150, Math.round(km * rate * demandMult * cityMult));
}

/** @deprecated legacy hourly curve */
export function tripHourlyRateRub(tripMinutes: number, curve: TaxiPayoutCurve): number {
  const min = curve.tripMinutesMin;
  const max = curve.tripMinutesMax;
  const mid = curve.midTripMinutes;
  const m = Math.max(min, Math.min(max, tripMinutes));
  if (m <= mid) {
    const t = mid === min ? 1 : (m - min) / (mid - min);
    return curve.hourlyAtMinTrip + (curve.hourlyAtMidTrip - curve.hourlyAtMinTrip) * t;
  }
  const t = max === mid ? 1 : (m - mid) / (max - mid);
  return curve.hourlyAtMidTrip + (curve.hourlyAtMaxTrip - curve.hourlyAtMidTrip) * t;
}

/** @deprecated */
export function tripPayoutRub(tripMinutes: number, curve: TaxiPayoutCurve): number {
  const rate = tripHourlyRateRub(tripMinutes, curve);
  return Math.max(1, Math.round((rate * tripMinutes) / 60));
}

/** @deprecated */
export function rollTripMinutes(curve: TaxiPayoutCurve): number {
  return randInt(curve.tripMinutesMin, curve.tripMinutesMax);
}

export function cashPaymentRiskChances(
  passengerRating: number,
  cfg: TaxiCashRiskConfig,
): { noPayChance: number; partialPayChance: number } {
  const deficit = Math.max(0, 4.5 - passengerRating);
  const noPayChance = Math.min(
    0.08,
    cfg.cashNoPayBaseChance + deficit * cfg.cashNoPayPerRatingBelow45,
  );
  const partialPayChance = Math.min(
    0.15,
    cfg.cashPartialPayBaseChance + deficit * cfg.cashPartialPayPerRatingBelow45,
  );
  return { noPayChance, partialPayChance };
}
