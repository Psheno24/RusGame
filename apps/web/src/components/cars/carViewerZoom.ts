import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

/** Минимальная дистанция камеры относительно авто-подгонки (0.5 = ближе на 50%). */
export const DEFAULT_MIN_ZOOM_RATIO = 0.5;

/** Максимальная дистанция камеры относительно авто-подгонки (1.05 = дальше на 5%). */
export const DEFAULT_MAX_ZOOM_RATIO = 1.05;

export function applyOrbitZoomLimits(
  controls: OrbitControlsImpl,
  fitDistance: number,
  minRatio: number,
  maxRatio: number,
): { minDistance: number; maxDistance: number } {
  const minDistance = fitDistance * minRatio;
  const maxDistance = fitDistance * maxRatio;
  controls.minDistance = minDistance;
  controls.maxDistance = maxDistance;
  controls.update();
  return { minDistance, maxDistance };
}
