import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./config.js";
import type { JobTemplate } from "./gameData.js";

type JobSalariesFile = {
  cityMultipliers: Record<string, number>;
  omskBasePayouts: Record<string, number>;
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

  if (template.kind === "taxi_line" || template.kind === "delivery_line") {
    return template;
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

export function payoutVariancePct(): number {
  return config.payoutVariancePct;
}
