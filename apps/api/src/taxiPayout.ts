import { randInt } from "./random.js";

/** Кривая почасового дохода такси (база — Омск, тариф «Эконом»). */
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
  /** Доп. шанс за каждую «звезду» ниже 4.5 (редко, но растёт у плохих пассажиров). */
  cashNoPayPerRatingBelow45: number;
  cashPartialPayPerRatingBelow45: number;
  cashPartialPayFraction: number;
  parkCompensationFraction: number;
};

/** Почасовая ставка: 8k при 5 мин, 5k при 30 мин, 4k при 45 мин (линейно по сегментам). */
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

/** Выплата за поездку: почасовая ставка × длительность. */
export function tripPayoutRub(tripMinutes: number, curve: TaxiPayoutCurve): number {
  const rate = tripHourlyRateRub(tripMinutes, curve);
  return Math.max(1, Math.round((rate * tripMinutes) / 60));
}

export function rollTripMinutes(curve: TaxiPayoutCurve): number {
  return randInt(curve.tripMinutesMin, curve.tripMinutesMax);
}

/** Шансы проблем с наличными: только от рейтинга пассажира, базово очень низкие. */
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
