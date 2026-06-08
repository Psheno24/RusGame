export type CarPlateFaceTuning = {
  offsetX: number;
  offsetY: number;
  /** Отразить номер по горизонтали. */
  flipX?: boolean;
  /** Отразить номер по вертикали (переворот вверх ногами). */
  flipY?: boolean;
};

/** @deprecated Используйте CarPlateFaceTuning */
export type CarPlateAxisOffsets = CarPlateFaceTuning;

export type CarPlateDisplayTuning = {
  sizeScale: number;
  front: CarPlateFaceTuning;
  rear: CarPlateFaceTuning;
};

export type CarCardDisplayConfig = {
  fixed: boolean;
  azimuth: number;
  elevation: number;
  distanceRatio: number;
  modelOffsetX: number;
  modelOffsetY: number;
  modelOffsetZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
};

export type Car3dDisplayEntry = {
  plate?: CarPlateDisplayTuning;
  card?: CarCardDisplayConfig;
};

export const DEFAULT_PLATE_DISPLAY_TUNING: CarPlateDisplayTuning = {
  sizeScale: 1,
  front: { offsetX: 0, offsetY: 0 },
  rear: { offsetX: 0, offsetY: 0 },
};

export const DEFAULT_CARD_DISPLAY: CarCardDisplayConfig = {
  fixed: true,
  azimuth: 0.6256003566531485,
  elevation: 0.19152991635726332,
  distanceRatio: 0.5209440956247278,
  modelOffsetX: 0.34,
  modelOffsetY: 0.17,
  modelOffsetZ: 0.06,
  targetX: 0,
  targetY: 0,
  targetZ: 0,
};

/** Исходный ракурс при добавлении модели — без смещений карточки. */
export const DEFAULT_ORBIT_DISPLAY: CarCardDisplayConfig = {
  fixed: false,
  azimuth: 0.85,
  elevation: 0.35,
  distanceRatio: 1,
  modelOffsetX: 0,
  modelOffsetY: 0,
  modelOffsetZ: 0,
  targetX: 0,
  targetY: 0,
  targetZ: 0,
};

/** Ближняя граница зума в режиме настройки номеров (ещё ближе, чем раньше). */
export const PLATE_TUNE_MIN_ZOOM_RATIO = 0.25;

/** Дальняя граница зума = прежнее «максимальное» приближение. */
export const PLATE_TUNE_MAX_ZOOM_RATIO = 0.5;

/** Ракурс для настройки номеров — низко, близко, только влево/вправо. */
export const PLATE_TUNE_DISPLAY: CarCardDisplayConfig = {
  fixed: false,
  azimuth: 0.85,
  elevation: 0.07,
  distanceRatio: PLATE_TUNE_MAX_ZOOM_RATIO,
  modelOffsetX: 0,
  modelOffsetY: 0,
  modelOffsetZ: 0,
  targetX: 0,
  targetY: -0.14,
  targetZ: 0,
};

/** Ползунок −1…1 → доля ширины/высоты плашки. */
export const PLATE_OFFSET_SLIDER_UNIT = 0.85;

/** Диапазоны ползунков в админке (госномера). */
export const PLATE_TUNING_SIZE_MIN = 0.05;
export const PLATE_TUNING_SIZE_MAX = 10;
export const PLATE_TUNING_OFFSET_MIN = -20;
export const PLATE_TUNING_OFFSET_MAX = 20;

/** Смещение модели на карточке магазина (локальные единицы сцены). */
export const CARD_TUNING_OFFSET_MIN = -5;
export const CARD_TUNING_OFFSET_MAX = 5;

export type CarViewStateSnapshot = {
  fitDistance: number;
  azimuth: number;
  elevation: number;
  distanceRatio: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  modelOffsetX: number;
  modelOffsetY: number;
  modelOffsetZ: number;
};

export function mergePlateDisplayTuning(
  base?: CarPlateDisplayTuning | null,
): CarPlateDisplayTuning {
  return {
    sizeScale: base?.sizeScale ?? DEFAULT_PLATE_DISPLAY_TUNING.sizeScale,
    front: {
      offsetX: base?.front?.offsetX ?? 0,
      offsetY: base?.front?.offsetY ?? 0,
      flipX: base?.front?.flipX ?? false,
      flipY: base?.front?.flipY ?? false,
    },
    rear: {
      offsetX: base?.rear?.offsetX ?? 0,
      offsetY: base?.rear?.offsetY ?? 0,
      flipX: base?.rear?.flipX ?? false,
      flipY: base?.rear?.flipY ?? false,
    },
  };
}

export function mergeCardDisplayConfig(
  base?: CarCardDisplayConfig | null,
): CarCardDisplayConfig {
  return {
    fixed: base?.fixed ?? DEFAULT_CARD_DISPLAY.fixed,
    azimuth: base?.azimuth ?? DEFAULT_CARD_DISPLAY.azimuth,
    elevation: base?.elevation ?? DEFAULT_CARD_DISPLAY.elevation,
    distanceRatio: base?.distanceRatio ?? DEFAULT_CARD_DISPLAY.distanceRatio,
    modelOffsetX: base?.modelOffsetX ?? DEFAULT_CARD_DISPLAY.modelOffsetX,
    modelOffsetY: base?.modelOffsetY ?? DEFAULT_CARD_DISPLAY.modelOffsetY,
    modelOffsetZ: base?.modelOffsetZ ?? DEFAULT_CARD_DISPLAY.modelOffsetZ,
    targetX: base?.targetX ?? DEFAULT_CARD_DISPLAY.targetX,
    targetY: base?.targetY ?? DEFAULT_CARD_DISPLAY.targetY,
    targetZ: base?.targetZ ?? DEFAULT_CARD_DISPLAY.targetZ,
  };
}
