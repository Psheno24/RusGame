/**
 * Ортогональная схема: прямые линии. Подписи по центру над/под точкой.
 */

export type CityNodeLayout = {
  x: number;
  y: number;
  shortName: string;
  labelX: number;
  labelY: number;
  labelAnchor: "start" | "middle" | "end";
};

const X_WEST = 56;
const Y0 = 30;
const STEP_V = 46;
const Y_EAST = 84;
const STEP_H = 54;

const L = {
  west: (x: number, y: number) => ({ labelX: x + 11, labelY: y + 4, labelAnchor: "start" as const }),
  left: (x: number, y: number) => ({ labelX: x - 6, labelY: y + 4, labelAnchor: "end" as const }),
  above: (x: number, y: number) => ({ labelX: x, labelY: y - 11, labelAnchor: "middle" as const }),
  below: (x: number, y: number) => ({ labelX: x, labelY: y + 14, labelAnchor: "middle" as const }),
  branch: (x: number, y: number) => ({ labelX: x + 11, labelY: y + 4, labelAnchor: "start" as const }),
};

function pin(
  x: number,
  y: number,
  shortName: string,
  label: keyof typeof L,
): CityNodeLayout {
  return { x, y, shortName, ...L[label](x, y) };
}

const MOSCOW_Y = Y0 + STEP_V;
const KAZAN_X = X_WEST + STEP_H * 2;

/** Запас по краям под длинные подписи (точки на прежних местах). */
export const MAP_VB = { w: 580, h: 320 };

export const CITY_NODES: Record<string, CityNodeLayout> = {
  spb: pin(X_WEST, Y0, "Санкт-Петербург", "west"),
  moscow: pin(X_WEST, MOSCOW_Y, "Москва", "left"),
  voronezh: pin(X_WEST, Y0 + STEP_V * 2, "Воронеж", "west"),
  volgograd: pin(X_WEST, Y0 + STEP_V * 3, "Волгоград", "west"),
  rostov: pin(X_WEST, Y0 + STEP_V * 4, "Ростов-на-Дону", "west"),
  krasnodar: pin(X_WEST, Y0 + STEP_V * 5, "Краснодар", "west"),

  nn: pin(X_WEST + STEP_H, Y_EAST, "Н. Новгород", "above"),
  kazan: pin(KAZAN_X, Y_EAST, "Казань", "below"),
  ufa: pin(KAZAN_X + STEP_H, Y_EAST, "Уфа", "above"),
  ekb: pin(KAZAN_X + STEP_H * 2, Y_EAST, "Екатеринбург", "below"),
  chelyabinsk: pin(KAZAN_X + STEP_H * 3, Y_EAST, "Челябинск", "above"),
  omsk: pin(KAZAN_X + STEP_H * 4, Y_EAST, "Омск", "below"),
  novosibirsk: pin(KAZAN_X + STEP_H * 5, Y_EAST, "Новосибирск", "above"),
  krasnoyarsk: pin(KAZAN_X + STEP_H * 6, Y_EAST, "Красноярск", "below"),

  perm: pin(KAZAN_X, Y0, "Пермь", "branch"),
  samara: pin(KAZAN_X, Y_EAST + STEP_V, "Самара", "branch"),
};

export const ROUTE_CHAINS: string[][] = [
  ["spb", "moscow", "voronezh", "volgograd", "rostov", "krasnodar"],
  ["moscow", "nn", "kazan", "ufa", "ekb", "chelyabinsk", "omsk", "novosibirsk", "krasnoyarsk"],
  ["kazan", "perm"],
  ["kazan", "samara"],
];

const CHAR_W = 6.3;

export function nodeContentBounds(node: CityNodeLayout) {
  const len = node.shortName.length * CHAR_W;
  let left = node.labelX;
  let right = node.labelX;
  if (node.labelAnchor === "middle") {
    left -= len / 2;
    right += len / 2;
  } else if (node.labelAnchor === "start") {
    right += len;
  } else {
    left -= len;
  }
  return {
    left: Math.min(left, node.x - 10),
    right: Math.max(right, node.x + 10),
    top: Math.min(node.labelY - 12, node.y - 10),
    bottom: Math.max(node.labelY + 4, node.y + 12),
  };
}

export function chainToPoints(ids: string[]): string {
  return ids
    .map((id) => CITY_NODES[id])
    .filter(Boolean)
    .map((n) => `${n.x},${n.y}`)
    .join(" ");
}
