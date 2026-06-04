import { CITY_NODES, MAP_VB, nodeContentBounds } from "./mapMetroLayout";

export type MapViewBox = { x: number; y: number; w: number; h: number };

export const MAP_VB_FULL: MapViewBox = { x: 0, y: 0, w: MAP_VB.w, h: MAP_VB.h };

const MIN_W = 70;
const MIN_H = 52;
const MAX_W = MAP_VB.w;
const MAX_H = MAP_VB.h;

export function clampViewBox(vb: MapViewBox): MapViewBox {
  const w = Math.min(MAX_W, Math.max(MIN_W, vb.w));
  const h = Math.min(MAX_H, Math.max(MIN_H, vb.h));
  const x = Math.min(MAX_W - w, Math.max(0, vb.x));
  const y = Math.min(MAX_H - h, Math.max(0, vb.y));
  return { x, y, w, h };
}

/** Вся схема целиком с отступами. */
export function viewBoxFitAll(): MapViewBox {
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;

  for (const node of Object.values(CITY_NODES)) {
    const b = nodeContentBounds(node);
    left = Math.min(left, b.left, node.x - 12);
    right = Math.max(right, b.right, node.x + 12);
    top = Math.min(top, b.top, node.y - 12);
    bottom = Math.max(bottom, b.bottom, node.y + 12);
  }

  const pad = 20;
  return clampViewBox({
    x: left - pad,
    y: top - pad,
    w: right - left + pad * 2,
    h: bottom - top + pad * 2,
  });
}

/** Приближение к городу (меньше w/h — ближе). */
export function viewBoxAroundCityAt(
  cityId: string,
  focalX = 0.5,
  focalY = 0.5,
  level = 1,
): MapViewBox {
  const node = CITY_NODES[cityId];
  if (!node) return viewBoxFitAll();

  const b = nodeContentBounds(node);
  const cx = (b.left + b.right) / 2;
  const cy = (b.top + b.bottom) / 2;
  const w = 155 / level;
  const h = 115 / level;
  return clampViewBox({
    x: cx - w * focalX,
    y: cy - h * focalY,
    w,
    h,
  });
}

/** Приближение к городу (меньше w/h — ближе). */
export function viewBoxAroundCity(cityId: string, level = 1): MapViewBox {
  return viewBoxAroundCityAt(cityId, 0.5, 0.5, level);
}

export function viewBoxToString(vb: MapViewBox): string {
  return `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;
}

/** Масштаб UI внутри SVG: при сильном зуме линии/текст не раздуваются. */
export function mapUiScale(vb: MapViewBox): number {
  return Math.max(0.35, Math.min(1, vb.w / MAP_VB.w));
}

export function panViewBox(vb: MapViewBox, dxPx: number, dyPx: number, viewW: number, viewH: number): MapViewBox {
  const scaleX = vb.w / viewW;
  const scaleY = vb.h / viewH;
  return clampViewBox({
    x: vb.x - dxPx * scaleX,
    y: vb.y - dyPx * scaleY,
    w: vb.w,
    h: vb.h,
  });
}

export function zoomViewBox(
  vb: MapViewBox,
  factor: number,
  focalRatioX: number,
  focalRatioY: number,
): MapViewBox {
  const fx = vb.x + vb.w * focalRatioX;
  const fy = vb.y + vb.h * focalRatioY;
  const w = vb.w / factor;
  const h = vb.h / factor;
  return clampViewBox({
    x: fx - w * focalRatioX,
    y: fy - h * focalRatioY,
    w,
    h,
  });
}

export function wheelZoomFactor(deltaY: number): number {
  return deltaY < 0 ? 1.12 : 1 / 1.12;
}
