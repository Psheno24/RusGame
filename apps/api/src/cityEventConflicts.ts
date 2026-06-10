import type { CityEventTemplate, EventEffectDef, EventEffectType } from "./cityEventsCatalog.js";

export type EffectDirection = "+" | "-";

/** Направление эффекта: рост (+) или снижение (-) показателя. */
export function effectDirection(def: EventEffectDef): EffectDirection | null {
  if (def.min > 0 && def.max > 0) return "+";
  if (def.min < 0 && def.max < 0) return "-";
  if (def.min >= 0 && def.max > 0) return "+";
  if (def.min < 0 && def.max <= 0) return "-";
  return null;
}

function axisKey(type: EventEffectType, dir: EffectDirection): string {
  return `${type}:${dir}`;
}

/** Событие противоречит уже активным осям (рост vs снижение одного показателя). */
export function eventConflictsWithAxes(
  template: CityEventTemplate,
  activeAxes: Set<string>,
): boolean {
  for (const def of template.effects) {
    const dir = effectDirection(def);
    if (!dir) continue;
    const opposite = axisKey(def.type, dir === "+" ? "-" : "+");
    if (activeAxes.has(opposite)) return true;
  }
  return false;
}

export function registerEventAxes(template: CityEventTemplate, activeAxes: Set<string>): void {
  for (const def of template.effects) {
    const dir = effectDirection(def);
    if (dir) activeAxes.add(axisKey(def.type, dir));
  }
}

/** Проверка сгенерированного набора: нет противоположных эффектов на одной оси. */
export function eventsHaveOppositeConflict(
  events: { templateId: string; effects: { type: EventEffectType; value: number }[] }[],
  lookup: (id: string) => CityEventTemplate | undefined,
): boolean {
  const axes = new Set<string>();
  for (const ev of events) {
    const tmpl = lookup(ev.templateId);
    if (!tmpl) continue;
    if (eventConflictsWithAxes(tmpl, axes)) return true;
    registerEventAxes(tmpl, axes);
  }
  return false;
}
