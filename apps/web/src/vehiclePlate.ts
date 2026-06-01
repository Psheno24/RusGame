export type VehiclePlateParts = {
  l1: string;
  digits: string;
  l2: string;
  region: string;
};

/** Допустимые буквы на знаке → латиница как на реальном ГОСТ-номере. */
const PLATE_CYRILLIC_TO_LATIN: Record<string, string> = {
  А: "A",
  В: "B",
  Е: "E",
  К: "K",
  М: "M",
  Н: "H",
  О: "O",
  Р: "P",
  С: "C",
  Т: "T",
  У: "Y",
  Х: "X",
};

/** Символы для отрисовки на белом поле (латиница, как на знаке). */
export function platePartForDisplay(value: string): string {
  return [...value]
    .map((ch) => {
      const upper = ch.toUpperCase();
      return PLATE_CYRILLIC_TO_LATIN[upper] ?? upper;
    })
    .join("");
}

export function displayPlateParts(parts: VehiclePlateParts): VehiclePlateParts {
  return {
    l1: platePartForDisplay(parts.l1),
    digits: parts.digits,
    l2: platePartForDisplay(parts.l2),
    region: parts.region,
  };
}

/** Разбор строки вида «С 227 НА | 69 RUS». */
export function parseVehiclePlateText(text: string | null | undefined): VehiclePlateParts | null {
  if (!text) return null;
  const m = text.trim().match(/^(\S)\s+(\d{3})\s+(\S+)\s+\|\s+(\S+)\s+RUS$/iu);
  if (!m) return null;
  return { l1: m[1]!, digits: m[2]!, l2: m[3]!, region: m[4]! };
}

export function vehiclePlateAriaLabel(parts: VehiclePlateParts): string {
  return `${parts.l1} ${parts.digits} ${parts.l2}, регион ${parts.region}`;
}
