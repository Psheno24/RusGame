import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PlayerRow } from "./db.js";
import { getSkill, type SkillKey } from "./skills.js";
import { DATA_DIR } from "./config.js";
import type { JobTemplate } from "./gameData.js";

type JobSalariesFile = {
  cityMultipliers: Record<string, number>;
  omskBasePayouts: Record<string, number>;
  skillWeights: Record<string, Record<string, number>>;
  skillMultiplier: { min: number; max: number; referenceLevel: number };
  payoutVariancePct: number;
};

const config = JSON.parse(
  readFileSync(join(DATA_DIR, "jobSalaries.json"), "utf-8"),
) as JobSalariesFile;

export function getCitySalaryMultiplier(cityId: string): number {
  return config.cityMultipliers[cityId] ?? 1;
}

export function getOmskBasePayout(templateKey: string): number {
  return config.omskBasePayouts[templateKey] ?? 0;
}

export function getSkillWeights(templateKey: string): Record<string, number> {
  return config.skillWeights[templateKey] ?? {};
}

/** Взвешенный «уровень» навыков для работы (0–100+). */
export function weightedSkillLevel(
  player: PlayerRow,
  templateKey: string,
): number {
  const weights = getSkillWeights(templateKey);
  let sum = 0;
  let totalW = 0;
  for (const [key, w] of Object.entries(weights)) {
    if (w <= 0) continue;
    let val: number;
    if (key === "health") {
      val = player.health ?? 100;
    } else {
      val = getSkill(player, key as SkillKey);
    }
    sum += val * w;
    totalW += w;
  }
  if (totalW <= 0) return config.skillMultiplier.referenceLevel;
  return sum / totalW;
}

/** Множитель выплаты от навыков: −30% при нуле, +50% при уровне 2× эталона (25). */
export function skillPayoutMultiplier(player: PlayerRow, templateKey: string): number {
  const { min, max, referenceLevel } = config.skillMultiplier;
  const level = weightedSkillLevel(player, templateKey);
  const t = (level - referenceLevel) / referenceLevel;
  const mult = 1 + (t >= 0 ? t * (max - 1) : t * (1 - min));
  return Math.max(min, Math.min(max, mult));
}

function scalePayout(baseRub: number, cityId: string): number {
  return Math.round(baseRub * getCitySalaryMultiplier(cityId));
}

/** Применяет городской коэффициент к шаблону работы. */
export function applyCitySalaryToTemplate(
  templateKey: string,
  template: JobTemplate,
  cityId: string,
): JobTemplate {
  const base = getOmskBasePayout(templateKey);
  if (base <= 0) return template;

  const scaled = scalePayout(base, cityId);
  const variance = Math.round((scaled * config.payoutVariancePct) / 100);

  if (template.kind === "taxi_line") {
    return {
      ...template,
      taxiTargetIncomeRub: scaled,
      payoutMin: Math.round(scaled * 0.6),
      payoutMax: Math.round(scaled * 1.4),
    };
  }

  if (template.kind === "cooldown") {
    return {
      ...template,
      payoutMin: Math.max(1, scaled - variance),
      payoutMax: scaled + variance,
    };
  }

  return template;
}

export function finalShiftPayout(
  player: PlayerRow,
  templateKey: string,
  cityId: string,
  basePayoutRub: number,
  proportion = 1,
): number {
  const skillMult = skillPayoutMultiplier(player, templateKey);
  return Math.max(0, Math.floor(basePayoutRub * proportion * skillMult));
}

export function payoutVariancePct(): number {
  return config.payoutVariancePct;
}
