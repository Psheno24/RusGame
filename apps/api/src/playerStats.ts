import { formatRub } from "./formatRub.js";
import type { PlayerRow } from "./db.js";
import type { SkillKey } from "./skills.js";
import { clampBibleMood, moodEnergyCostMultiplier } from "./balanceBible.js";
import { applyPercentModifier, energyCostModifier } from "./cityEffectModifiers.js";
import { effectiveMood } from "./housingMood.js";

export type VitalKey = "energy" | "mood" | "health";

export type StatCosts = Partial<Record<VitalKey, number>> & { rubles?: number };
export type StatGains = Partial<Record<VitalKey, number>> & {
  rubles?: number | [number, number];
  skill?: Partial<Record<SkillKey, number>>;
};

const VITAL_MAX: Record<VitalKey, number> = {
  energy: 100,
  mood: 100,
  health: 100,
};

export const REPUTATION_MAX = 1000;
export const REPUTATION_MIN = -1000;
export const DEFAULT_VITALS = {
  energy: 80,
  mood: 0,
  health: 100,
  reputation: 0,
};

export function clampVital(key: VitalKey, value: number): number {
  if (key === "mood") return clampBibleMood(value);
  return Math.max(0, Math.min(VITAL_MAX[key], Math.round(value)));
}

export function clampReputation(value: number): number {
  return Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, Math.round(value)));
}

export function getPlayerVitals(player: PlayerRow) {
  return {
    energy: player.energy ?? DEFAULT_VITALS.energy,
    mood: effectiveMood(player),
    health: player.health ?? DEFAULT_VITALS.health,
    reputation: player.reputation ?? DEFAULT_VITALS.reputation,
  };
}

export function canAffordCosts(player: PlayerRow, costs?: StatCosts): string | null {
  if (!costs) return null;
  if (costs.rubles != null && player.rubles < costs.rubles) {
    return `Не хватает денег (нужно ${formatRub(costs.rubles)})`;
  }
  const v = getPlayerVitals(player);
  if (costs.energy != null && v.energy < costs.energy) {
    return `Недостаточно энергии (нужно ${costs.energy})`;
  }
  return null;
}

export function applyStatChanges(
  player: PlayerRow,
  costs?: StatCosts,
  gains?: StatGains,
): Partial<PlayerRow> {
  const v = getPlayerVitals(player);
  const patch: Partial<PlayerRow> = {};

  if (costs?.rubles != null) patch.rubles = player.rubles - costs.rubles;
  if (costs?.energy != null) {
    patch.energy = clampVital("energy", v.energy - costs.energy);
  }
  if (costs?.health != null) {
    patch.health = clampVital("health", v.health - costs.health);
  }

  const afterCosts = {
    energy: patch.energy ?? v.energy,
    health: patch.health ?? v.health,
    reputation: v.reputation,
  };

  if (gains?.rubles != null) {
    const add = Array.isArray(gains.rubles)
      ? Math.floor(gains.rubles[0] + Math.random() * (gains.rubles[1] - gains.rubles[0] + 1))
      : gains.rubles;
    patch.rubles = (patch.rubles ?? player.rubles) + add;
  }
  if (gains?.energy != null) {
    patch.energy = clampVital("energy", afterCosts.energy + gains.energy);
  }
  if (gains?.health != null) {
    patch.health = clampVital("health", afterCosts.health + gains.health);
  }

  if (gains?.skill) {
    for (const [key, amount] of Object.entries(gains.skill)) {
      if (amount == null) continue;
      const k = key as SkillKey;
      patch[k] = (player[k] ?? 0) + amount;
    }
  }

  return patch;
}

export function workPayoutMultiplier(_player: PlayerRow): number {
  return 1;
}

export function scaleWorkCosts(
  player: PlayerRow,
  costs?: StatCosts,
  now = Date.now(),
): StatCosts | undefined {
  if (!costs) return costs;
  const mood = effectiveMood(player, now);
  const mult = moodEnergyCostMultiplier(mood);
  const eventPct = energyCostModifier(player.city_id, now).totalPct;
  const scaled = { ...costs };
  if (scaled.energy != null) {
    let energy = Math.max(1, Math.round(scaled.energy * mult));
    if (eventPct) energy = applyPercentModifier(energy, eventPct);
    scaled.energy = energy;
  }
  return scaled;
}

