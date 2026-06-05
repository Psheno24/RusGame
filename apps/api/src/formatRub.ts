/** Неразрывный пробел перед ₽ — сумма и знак валюты не переносятся на разные строки. */
export const RUB_SUFFIX = "\u00A0₽";

export function formatRub(n: number): string {
  return `${n.toLocaleString("ru-RU")}${RUB_SUFFIX}`;
}

export function formatRubRange(min: number, max: number): string {
  if (min === max) return formatRub(min);
  return `${min.toLocaleString("ru-RU")}–${max.toLocaleString("ru-RU")}${RUB_SUFFIX}`;
}

export function formatRubPerHour(min: number, max: number): string {
  if (min === max) return `${min.toLocaleString("ru-RU")}${RUB_SUFFIX}/ч`;
  return `${min.toLocaleString("ru-RU")}–${max.toLocaleString("ru-RU")}${RUB_SUFFIX}/ч`;
}

export function formatRubPerWeek(n: number): string {
  return `${n.toLocaleString("ru-RU")}${RUB_SUFFIX}/нед`;
}
