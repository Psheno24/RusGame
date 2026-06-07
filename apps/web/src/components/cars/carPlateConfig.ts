export type CarPlateConfig = {
  /** Отдельный mesh плашки номера (не весь передний блок). */
  plateMeshName: string;
};

const PLATE_CONFIG_BY_MODEL: Record<string, CarPlateConfig> = {
  "toyota-camry": {
    plateMeshName: "Index_0_1_BD_2",
  },
};

export function getCarPlateConfig(modelId: string): CarPlateConfig | null {
  return PLATE_CONFIG_BY_MODEL[modelId] ?? null;
}

export function registerCarPlateConfig(modelId: string, config: CarPlateConfig): void {
  PLATE_CONFIG_BY_MODEL[modelId] = config;
}
