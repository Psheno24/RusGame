export { CarCard } from "./CarCard";
export { CarViewer } from "./CarViewer";
export { DEFAULT_MAX_ZOOM_RATIO, DEFAULT_MIN_ZOOM_RATIO } from "./carViewerZoom";
export { getCarModelPath, registerCarModelFile } from "./carModelRegistry";
export { getCarBodyColorConfig, registerCarBodyColorConfig } from "./carBodyColorConfig";
export { getCarPlateConfig, registerCarPlateConfig } from "./carPlateConfig";
export { resolveVehiclePlateParts } from "./carPlate";
export {
  applyBodyColor,
  DEFAULT_BODY_COLOR_CONFIG,
  inspectCarModel,
  type CarBodyColorConfig,
  type CarModelInspection,
} from "./carBodyColor";
export type { CarCardProps, CarDisplayInfo, CarViewerProps, CarZoomLimitsInfo } from "./types";
