import { SLEEP_MS_FOR_FULL_ENERGY } from "./sleepConstants";

export const SLEEP_ENERGY_STEP = 5;
export const SLEEP_MIN_MS = 15 * 60 * 1000;

/** Первая цель на ползунке — ближайшее значение энергии с шагом 5 выше текущей. */
export function minTargetEnergy(current: number): number {
  if (current >= 100) return 100;
  return Math.min(100, Math.ceil((current + 1) / SLEEP_ENERGY_STEP) * SLEEP_ENERGY_STEP);
}

/** Длительность сна под выбранную целевую энергию. */
export function sleepMsForTargetEnergy(current: number, target: number): number {
  const gain = Math.max(0, target - current);
  if (gain <= 0) return SLEEP_MIN_MS;
  const ms = (gain / 100) * SLEEP_MS_FOR_FULL_ENERGY;
  return Math.max(SLEEP_MIN_MS, Math.round(ms));
}
