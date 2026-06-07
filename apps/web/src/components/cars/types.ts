import type { MutableRefObject } from "react";
import type { VehiclePlateParts } from "../../api";
import type {
  CarCardDisplayConfig,
  CarPlateDisplayTuning,
  CarViewStateSnapshot,
} from "./carDisplayConfig";
export type CarRearPlateTuning = {
  sizeScale: number;
  offsetY: number;
};

/** Данные автомобиля для карточки и 3D-просмотра (магазин, профиль, гараж, б/у). */
export type CarDisplayInfo = {
  modelId: string;
  name: string;
  carClassLabel: string;
  speed: number;
  reliability: number;
  priceRub: number;
  plateText?: string | null;
  plate?: VehiclePlateParts | null;
  bodyColor?: string | null;
};

export type CarZoomLimitsInfo = {
  fitDistance: number;
  minDistance: number;
  maxDistance: number;
};

export type CarViewerCameraMode = "default" | "plateTune";

export type CarViewerProps = {
  modelId: string;
  modelPath?: string;
  bodyColor?: string | null;
  plate?: VehiclePlateParts | null;
  plateText?: string | null;
  className?: string;
  height?: number | string;
  enableZoom?: boolean;
  minZoomRatio?: number;
  maxZoomRatio?: number;
  onZoomLimitsChange?: (limits: CarZoomLimitsInfo) => void;
  plateTuning?: CarPlateDisplayTuning;
  /** @deprecated Используйте plateTuning */
  rearPlateTuning?: CarRearPlateTuning;
  modelOffset?: { x: number; y: number; z: number };
  cardDisplay?: CarCardDisplayConfig;
  lockCamera?: boolean;
  cameraMode?: CarViewerCameraMode;
  transparentBackground?: boolean;
  viewStateRef?: MutableRefObject<CarViewStateSnapshot | null>;
  onViewStateChange?: (state: CarViewStateSnapshot) => void;
};

export type CarCardProps = {
  car: CarDisplayInfo;
  variant?: "default" | "compact";
  showPrice?: boolean;
  showSpecs?: boolean;
  onClick?: () => void;
  className?: string;
  cardDisplay?: CarCardDisplayConfig;
  plateTuning?: CarPlateDisplayTuning;
};
