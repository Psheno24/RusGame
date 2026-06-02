import type { PlayerRow } from "./db.js";
import type { SkillKey } from "./auth.js";
import { effectiveMood } from "./housingMood.js";

export type VitalKey = "energy" | "hunger" | "mood" | "health";

export type StatCosts = Partial<Record<VitalKey, number>> & { rubles?: number };
export type StatGains = Partial<Record<VitalKey, number>> & {
  rubles?: number | [number, number];
  skill?: Partial<Record<SkillKey, number>>;
};

const VITAL_MAX: Record<VitalKey, number> = {
  energy: 100,
  hunger: 100,
  mood: 100,
  health: 100,
};

export const REPUTATION_MAX = 1000;
export const DEFAULT_VITALS = {
  energy: 80,
  hunger: 80,
  mood: 70,
  health: 100,
  reputation: 100,
};

export function clampVital(key: VitalKey, value: number): number {
  return Math.max(0, Math.min(VITAL_MAX[key], Math.round(value)));
}

export function clampReputation(value: number): number {
  return Math.max(0, Math.min(REPUTATION_MAX, Math.round(value)));
}

export function getPlayerVitals(player: PlayerRow) {
  return {
    energy: player.energy ?? DEFAULT_VITALS.energy,
    hunger: player.hunger ?? DEFAULT_VITALS.hunger,
    mood: player.mood ?? DEFAULT_VITALS.mood,
    health: player.health ?? DEFAULT_VITALS.health,
    reputation: player.reputation ?? DEFAULT_VITALS.reputation,
  };
}

export function canAffordCosts(player: PlayerRow, costs?: StatCosts): string | null {
  if (!costs) return null;
  const v = getPlayerVitals(player);
  if (costs.rubles != null && player.rubles < costs.rubles) {
    return `Не хватает денег (нужно ${costs.rubles.toLocaleString("ru-RU")} ₽)`;
  }
  if (costs.energy != null && v.energy < costs.energy) {
    return `Мало энергии (нужно ${costs.energy}, у вас ${v.energy})`;
  }
  if (costs.hunger != null && v.hunger < costs.hunger) {
    return `Слишком голодны для этого действия`;
  }
  if (costs.mood != null && effectiveMood(player) < costs.mood) {
    return `Слишком плохое настроение`;
  }
  if (costs.health != null && v.health < costs.health) {
    return `Слишком плохое здоровье`;
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
  if (costs?.energy != null) patch.energy = clampVital("energy", v.energy - costs.energy);
  if (costs?.hunger != null) patch.hunger = clampVital("hunger", v.hunger - costs.hunger);
  if (costs?.mood != null) patch.mood = clampVital("mood", v.mood - costs.mood);
  if (costs?.health != null) patch.health = clampVital("health", v.health - costs.health);

  const afterCosts = {
    energy: patch.energy ?? v.energy,
    hunger: patch.hunger ?? v.hunger,
    mood: patch.mood ?? v.mood,
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
  if (gains?.hunger != null) {
    patch.hunger = clampVital("hunger", afterCosts.hunger + gains.hunger);
  }
  if (gains?.mood != null) {
    patch.mood = clampVital("mood", afterCosts.mood + gains.mood);
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

/** Множитель выплаты от усталости и голода. */
export function workPayoutMultiplier(player: PlayerRow): number {
  const v = getPlayerVitals(player);
  let mult = 1;
  if (v.energy < 20) mult *= 0.85;
  if (v.hunger < 10) mult *= 0.7;
  if (effectiveMood(player) < 25) mult *= 0.9;
  return mult;
}

const HUNGRY_THRESHOLD = 20;
const STARVING_THRESHOLD = 10;

/** Дополнительный расход энергии на работе при низкой сытости. */
export function scaleWorkCosts(player: PlayerRow, costs?: StatCosts): StatCosts | undefined {
  if (!costs) return costs;
  const v = getPlayerVitals(player);
  if (v.hunger >= HUNGRY_THRESHOLD) return costs;
  const baseEnergy = costs.energy ?? 0;
  if (baseEnergy <= 0) return costs;
  const extra = Math.max(1, Math.ceil(baseEnergy * 0.25));
  return { ...costs, energy: baseEnergy + extra };
}

/** Штраф здоровью после работы при плохом самочувствии. */
export function applyPostWorkPassives(
  player: PlayerRow,
  afterWork: Partial<PlayerRow>,
): Partial<PlayerRow> {
  const merged = { ...player, ...afterWork } as PlayerRow;
  const v = getPlayerVitals(merged);
  const patch: Partial<PlayerRow> = {};

  if (v.hunger < 15 || (v.hunger < HUNGRY_THRESHOLD && v.energy < 15)) {
    patch.health = clampVital("health", v.health - 1);
  }
  if (v.hunger < STARVING_THRESHOLD && v.energy < 25) {
    patch.health = clampVital("health", (patch.health ?? v.health) - 1);
  }

  return patch;
}
