import type { PlayerRow } from "./db.js";

/** Без верхнего лимита (GAME_BALANCE_BIBLE_V1). */
export const SKILL_MAX = Number.MAX_SAFE_INTEGER;
export const SKILL_PROGRESS_EVERY = 10;

export type SkillKey = "driving" | "stamina" | "charisma" | "discipline";

export type SkillProgressKey = "taxi_trips" | "delivery" | "cashier" | "night_guard";

export const SKILL_LABELS: Record<SkillKey, string> = {
  driving: "Вождение",
  stamina: "Стойкость",
  charisma: "Общение",
  discipline: "Дисциплина",
};

export type SkillProgress = Record<SkillProgressKey, number>;

const PROGRESS_KEYS: SkillProgressKey[] = ["taxi_trips", "delivery", "cashier", "night_guard"];

export const JOB_SKILL_BY_TEMPLATE: Record<
  string,
  { progressKey: SkillProgressKey; skill: SkillKey }
> = {
  taxi: { progressKey: "taxi_trips", skill: "driving" },
  delivery: { progressKey: "delivery", skill: "stamina" },
  cashier: { progressKey: "cashier", skill: "charisma" },
  night_guard: { progressKey: "night_guard", skill: "discipline" },
};

export function clampSkill(value: number): number {
  return Math.max(0, Math.floor(value));
}

export function getSkill(
  player: Pick<PlayerRow, SkillKey>,
  key: SkillKey,
): number {
  return player[key] ?? 0;
}

export function emptySkillProgress(): SkillProgress {
  return { taxi_trips: 0, delivery: 0, cashier: 0, night_guard: 0 };
}

export function parseSkillProgress(raw: string | null | undefined): SkillProgress {
  if (!raw) return emptySkillProgress();
  try {
    const parsed = JSON.parse(raw) as Partial<SkillProgress>;
    const out = emptySkillProgress();
    for (const k of PROGRESS_KEYS) {
      const v = parsed[k];
      if (typeof v === "number" && v >= 0) out[k] = Math.floor(v);
    }
    return out;
  } catch {
    return emptySkillProgress();
  }
}

export function serializeSkillProgress(progress: SkillProgress): string {
  return JSON.stringify(progress);
}

export function progressTowardNext(progress: SkillProgress, key: SkillProgressKey): number {
  return progress[key] % SKILL_PROGRESS_EVERY;
}

export type SkillGrantResult = {
  patch: Partial<PlayerRow>;
  granted?: { key: SkillKey; amount: number };
};

/** Учитывает действие (смена или поездка); каждые 10 — +1 к связанному навыку (макс. 100). */
export function recordSkillAction(
  player: PlayerRow,
  progressKey: SkillProgressKey,
): SkillGrantResult {
  const mapping = Object.values(JOB_SKILL_BY_TEMPLATE).find((m) => m.progressKey === progressKey);
  if (!mapping) return { patch: {} };

  const progress = parseSkillProgress(player.skill_progress);
  progress[progressKey] += 1;

  const patch: Partial<PlayerRow> = {
    skill_progress: serializeSkillProgress(progress),
  };

  if (progress[progressKey] % SKILL_PROGRESS_EVERY !== 0) {
    return { patch };
  }

  const current = getSkill(player, mapping.skill);
  patch[mapping.skill] = clampSkill(current + 1);
  return { patch, granted: { key: mapping.skill, amount: 1 } };
}

export function recordSkillActionForTemplate(
  player: PlayerRow,
  templateKey: string,
): SkillGrantResult {
  const mapping = JOB_SKILL_BY_TEMPLATE[templateKey];
  if (!mapping) return { patch: {} };
  return recordSkillAction(player, mapping.progressKey);
}
