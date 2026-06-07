export type CarPlateAxisOffsets = {
  offsetX: number;
  offsetY: number;
};

export type CarPlateDisplayTuning = {
  sizeScale: number;
  front: CarPlateAxisOffsets;
  rear: CarPlateAxisOffsets;
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

/** Ползунок −1…1 → доля ширины/высоты плашки. */
export const PLATE_OFFSET_SLIDER_UNIT = 0.85;

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
    },
    rear: {
      offsetX: base?.rear?.offsetX ?? 0,
      offsetY: base?.rear?.offsetY ?? 0,
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
