import type { CarBodyColorConfig } from "./carBodyColor";

const BODY_COLOR_CONFIG_BY_MODEL: Record<string, CarBodyColorConfig> = {
  "toyota-camry": {
    bodyMaterialNames: ["Paint_Color"],
    bodyMeshNames: ["Paint_Color_BD"],
  },
  "lada-vesta": {
    bodyMaterialNames: ["kuzov"],
  },
  "vw-polo": {
    bodyMaterialNames: ["KUZOV", "paint_Black"],
  },
  "kia-k5": {
    bodyMaterialNames: ["insta_ua1k"],
    bodyMeshNames: [
      "mesh_11",
      "mesh_12",
      "mesh_15",
      "mesh_16",
      "mesh_17",
      "mesh_19",
      "mesh_33",
      "mesh_34",
      "mesh_35",
      "mesh_36",
      "mesh_37",
      "mesh_38",
      "mesh_39",
      "mesh_41",
      "mesh_43",
      "mesh_45",
      "mesh_54",
      "mesh_57",
      "mesh_58",
      "mesh_59",
      "mesh_63",
    ],
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
