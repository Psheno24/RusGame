import type { VehiclePlateParts } from "../../api";

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
  /** Цвет кузова — будет применяться после определения материала кузова в GLB. */
  bodyColor?: string | null;
};

export type CarZoomLimitsInfo = {
  fitDistance: number;
  minDistance: number;
  maxDistance: number;
};

export type CarViewerProps = {
  modelId: string;
  /** Переопределение пути к GLB (иначе — из реестра). */
  modelPath?: string;
  bodyColor?: string | null;
  plate?: VehiclePlateParts | null;
  plateText?: string | null;
  className?: string;
  height?: number | string;
  enableZoom?: boolean;
  /** Доля от авто-подгонки для мин. дистанции (приближение). */
  minZoomRatio?: number;
  /** Доля от авто-подгонки для макс. дистанции (отдаление). */
  maxZoomRatio?: number;
  onZoomLimitsChange?: (limits: CarZoomLimitsInfo) => void;
};

export type CarCardProps = {
  car: CarDisplayInfo;
  variant?: "default" | "compact";
  showPrice?: boolean;
  onClick?: () => void;
  className?: string;
};
