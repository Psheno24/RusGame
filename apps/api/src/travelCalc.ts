/**
 * Стоимость и время в пути по числу клеток на схеме карты.
 * Поезд: 1 клетка = 1 ч = 5 000 ₽. Самолёт (если доступен): 1 клетка = 30 мин = 10 000 ₽.
 */

import type { City } from "./gameData.js";
import { getCity } from "./gameData.js";
import { isOnMapGraph, mapGraphDistance } from "./mapGraph.js";
import { applyTravelDurationMs } from "./cityEffectModifiers.js";

export type TravelMode = "train" | "plane";

export type TravelRoute = {
  mode: TravelMode;
  priceRub: number;
  durationMs: number;
  graphDistance: number;
};

const TRAIN_PRICE_PER_CELL_RUB = 5_000;
const TRAIN_MS_PER_CELL = 60 * 60 * 1000;
const PLANE_PRICE_PER_CELL_RUB = 10_000;
const PLANE_MS_PER_CELL = 30 * 60 * 1000;

/** Минимальная длина маршрута для прямого рейса (клетки). */
const PLANE_MIN_CELLS = 4;
const PLANE_LONG_CELLS = 7;
const PLANE_TIER3_CELLS = 4;

function trainPriceRub(cells: number): number {
  return cells * TRAIN_PRICE_PER_CELL_RUB;
}

function trainDurationMs(cells: number): number {
  return cells * TRAIN_MS_PER_CELL;
}

function planePriceRub(cells: number): number {
  return cells * PLANE_PRICE_PER_CELL_RUB;
}

function planeDurationMs(cells: number): number {
  return cells * PLANE_MS_PER_CELL;
}

function planeAvailable(from: City, to: City, cells: number): boolean {
  if (cells < PLANE_MIN_CELLS) return false;
  const maxTier = Math.max(from.tier, to.tier);
  const minTier = Math.min(from.tier, to.tier);
  if (maxTier >= 4) return true;
  if (cells >= PLANE_LONG_CELLS) return true;
  if (maxTier >= 3 && cells >= PLANE_TIER3_CELLS) return true;
  return minTier >= 2 && maxTier >= 3 && cells >= PLANE_MIN_CELLS;
}

export function getMapTravelDistance(fromId: string, toId: string): number | null {
  if (fromId === toId) return 0;
  return mapGraphDistance(fromId, toId);
}

export function computeTravelRoute(
  fromId: string,
  toId: string,
  mode: TravelMode,
  now = Date.now(),
): TravelRoute | null {
  if (fromId === toId) return null;
  const from = getCity(fromId);
  const to = getCity(toId);
  if (!from || !to) return null;
  if (!isOnMapGraph(fromId) || !isOnMapGraph(toId)) return null;

  const graphDistance = mapGraphDistance(fromId, toId);
  if (graphDistance == null) return null;

  if (mode === "plane" && !planeAvailable(from, to, graphDistance)) return null;

  const priceRub = mode === "train" ? trainPriceRub(graphDistance) : planePriceRub(graphDistance);
  const baseDurationMs =
    mode === "train" ? trainDurationMs(graphDistance) : planeDurationMs(graphDistance);
  const durationMs = applyTravelDurationMs(baseDurationMs, fromId, now);

  return { mode, priceRub, durationMs, graphDistance };
}

export function getTravelOptions(fromId: string, toId: string): TravelRoute[] {
  const train = computeTravelRoute(fromId, toId, "train");
  if (!train) return [];
  const plane = computeTravelRoute(fromId, toId, "plane");
  return plane ? [train, plane] : [train];
}
