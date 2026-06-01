/**
 * Стоимость и время в пути по расстоянию на схеме карты.
 * Калибровка по реальным ЖД/авиа (2025–2026): Омск–Казань, Казань–Екб,
 * Краснодар–Красноярск (~4.5 суток поезд, плацкарт ~10 000 ₽; прямой рейс ~5 ч 40 м, от ~14 000 ₽).
 */

import type { City } from "./gameData.js";
import { getCity } from "./gameData.js";
import { isOnMapGraph, mapGraphDistance, MAX_MAP_GRAPH_DISTANCE } from "./mapGraph.js";

export type TravelMode = "train" | "plane";

export type TravelRoute = {
  mode: TravelMode;
  priceRub: number;
  durationMs: number;
  graphDistance: number;
};

/** Порог по схеме: короче — только поезд (как в жизни без прямых рейсов). */
const PLANE_MIN_GRAPH_DIST = 200;

/** Реальные ориентиры для самого длинного маршрута. */
const MAX_TRAIN_PRICE_RUB = 10_000;
const MAX_TRAIN_DURATION_MS = 8.5 * 60 * 60 * 1000;
const MAX_PLANE_PRICE_RUB = 15_500;
const MAX_PLANE_DURATION_MS = (5 * 60 + 40) * 60 * 1000;

const TRAIN_SHORT_BREAK = 180;

function trainPriceRub(graphDist: number): number {
  if (graphDist >= MAX_MAP_GRAPH_DISTANCE - 0.01) return MAX_TRAIN_PRICE_RUB;
  if (graphDist <= TRAIN_SHORT_BREAK) return Math.round(1200 + graphDist * 11.11);
  return Math.round(-1088 + graphDist * 18);
}

function trainDurationMs(graphDist: number): number {
  if (graphDist >= MAX_MAP_GRAPH_DISTANCE - 0.01) return MAX_TRAIN_DURATION_MS;
  if (graphDist <= TRAIN_SHORT_BREAK) return Math.round(graphDist * 83_333);
  return Math.round(graphDist * 50_000);
}

function planePriceRub(graphDist: number): number {
  if (graphDist >= MAX_MAP_GRAPH_DISTANCE - 0.01) return MAX_PLANE_PRICE_RUB;
  const t = Math.min(1, graphDist / MAX_MAP_GRAPH_DISTANCE);
  return Math.round(3_500 + t * (MAX_PLANE_PRICE_RUB - 3_500));
}

function planeDurationMs(graphDist: number): number {
  if (graphDist >= MAX_MAP_GRAPH_DISTANCE - 0.01) return MAX_PLANE_DURATION_MS;
  const t = Math.min(1, graphDist / MAX_MAP_GRAPH_DISTANCE);
  return Math.round((2 + t * 3.67) * 60 * 60 * 1000);
}

function planeAvailable(from: City, to: City, graphDist: number): boolean {
  if (graphDist < PLANE_MIN_GRAPH_DIST) return false;
  const maxTier = Math.max(from.tier, to.tier);
  const minTier = Math.min(from.tier, to.tier);
  if (maxTier >= 4) return true;
  if (graphDist >= 280) return true;
  if (maxTier >= 3 && graphDist >= 160) return true;
  return minTier >= 2 && maxTier >= 3 && graphDist >= PLANE_MIN_GRAPH_DIST;
}

export function getMapTravelDistance(fromId: string, toId: string): number | null {
  if (fromId === toId) return 0;
  return mapGraphDistance(fromId, toId);
}

export function computeTravelRoute(
  fromId: string,
  toId: string,
  mode: TravelMode,
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
  const durationMs = mode === "train" ? trainDurationMs(graphDistance) : planeDurationMs(graphDistance);

  return { mode, priceRub, durationMs, graphDistance };
}

export function getTravelOptions(fromId: string, toId: string): TravelRoute[] {
  const train = computeTravelRoute(fromId, toId, "train");
  if (!train) return [];
  const plane = computeTravelRoute(fromId, toId, "plane");
  return plane ? [train, plane] : [train];
}
