/**
 * Граф городов на схеме карты (совпадает с apps/web/src/mapMetroLayout.ts).
 * Расстояние — число клеток (рёбер) на кратчайшем пути.
 */

const X_WEST = 56;
const Y0 = 30;
const STEP_V = 46;
const Y_EAST = 84;
const STEP_H = 54;
const KAZAN_X = X_WEST + STEP_H * 2;

const NODE_COORDS: Record<string, [number, number]> = {
  spb: [X_WEST, Y0],
  moscow: [X_WEST, Y0 + STEP_V],
  voronezh: [X_WEST, Y0 + STEP_V * 2],
  volgograd: [X_WEST, Y0 + STEP_V * 3],
  rostov: [X_WEST, Y0 + STEP_V * 4],
  krasnodar: [X_WEST, Y0 + STEP_V * 5],
  nn: [X_WEST + STEP_H, Y_EAST],
  kazan: [KAZAN_X, Y_EAST],
  ufa: [KAZAN_X + STEP_H, Y_EAST],
  ekb: [KAZAN_X + STEP_H * 2, Y_EAST],
  chelyabinsk: [KAZAN_X + STEP_H * 3, Y_EAST],
  omsk: [KAZAN_X + STEP_H * 4, Y_EAST],
  novosibirsk: [KAZAN_X + STEP_H * 5, Y_EAST],
  krasnoyarsk: [KAZAN_X + STEP_H * 6, Y_EAST],
  perm: [KAZAN_X, Y0],
  samara: [KAZAN_X, Y_EAST + STEP_V],
};

const ROUTE_CHAINS: string[][] = [
  ["spb", "moscow", "voronezh", "volgograd", "rostov", "krasnodar"],
  ["moscow", "nn", "kazan", "ufa", "ekb", "chelyabinsk", "omsk", "novosibirsk", "krasnoyarsk"],
  ["kazan", "perm"],
  ["kazan", "samara"],
];

function buildAdjacency(): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!NODE_COORDS[a] || !NODE_COORDS[b]) return;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };
  for (const chain of ROUTE_CHAINS) {
    for (let i = 0; i < chain.length - 1; i++) link(chain[i]!, chain[i + 1]!);
  }
  return adj;
}

const ADJ = buildAdjacency();

/** Кратчайший путь по схеме в клетках (число рёбер). */
export function mapGraphDistance(fromId: string, toId: string): number | null {
  if (fromId === toId) return 0;
  if (!ADJ.has(fromId) || !ADJ.has(toId)) return null;

  const dist = new Map<string, number>([[fromId, 0]]);
  const queue = [fromId];
  while (queue.length > 0) {
    const u = queue.shift()!;
    if (u === toId) return dist.get(u)!;
    for (const v of ADJ.get(u) ?? []) {
      if (dist.has(v)) continue;
      dist.set(v, dist.get(u)! + 1);
      queue.push(v);
    }
  }
  return null;
}

/** Максимальное число клеток на карте (Краснодар — Красноярск). */
export const MAX_MAP_GRAPH_DISTANCE = (() => {
  let max = 0;
  const ids = Object.keys(NODE_COORDS);
  for (const a of ids) {
    for (const b of ids) {
      if (a >= b) continue;
      const d = mapGraphDistance(a, b);
      if (d != null && d > max) max = d;
    }
  }
  return max;
})();

export function isOnMapGraph(cityId: string): boolean {
  return ADJ.has(cityId);
}
