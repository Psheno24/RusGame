import type { CarBodyColorConfig } from "./carBodyColor";

const BODY_COLOR_CONFIG_BY_MODEL: Record<string, CarBodyColorConfig> = {
  "toyota-camry": {
    bodyMaterialNames: ["Paint_Color"],
    bodyMeshNames: ["Paint_Color_BD"],
  },
};

export function getCarBodyColorConfig(modelId: string): CarBodyColorConfig {
  return (
    BODY_COLOR_CONFIG_BY_MODEL[modelId] ?? {
      bodyMaterialNames: [],
      bodyMeshNames: [],
    }
  );
}

/** Зарегистрировать материалы кузова для модели. */
export function registerCarBodyColorConfig(
  modelId: string,
  config: CarBodyColorConfig,
): void {
  BODY_COLOR_CONFIG_BY_MODEL[modelId] = config;
}
