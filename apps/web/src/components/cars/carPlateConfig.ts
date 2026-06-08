export type RearPlatePlacementConfig = {
  /** Доля высоты bbox модели — нижняя граница ниши. */
  yMinRatio: number;
  /** Доля высоты bbox модели — верхняя граница ниши. */
  yMaxRatio: number;
  /** Ширина плашки относительно найденной ниши. */
  widthFactor?: number;
  /** Мин. ширина как доля ширины модели (если ниша уже). */
  minWidthRatio?: number;
  /** Вынос плоскости назад от ниши (−Z). */
  zOffset?: number;
  /** Смещение по Y в локальных координатах модели (+ выше). */
  offsetY?: number;
};

/** Фиксированная плоскость номера по bbox модели (0…1 от min). */
export type FixedPlanePlacementConfig = {
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  zOffset?: number;
};

export type CarPlateConfig = {
  /** Mesh плашки спереди (текстура на UV). */
  frontPlateMeshNames: string[];
  /** Плоскость спереди, если mesh в GLB нет. */
  frontPlatePlane?: boolean;
  /** Положение передней плоскости. */
  frontPlanePlacement?: FixedPlanePlacementConfig;
  /** Mesh плашки сзади (текстура на UV). */
  rearPlateMeshNames?: string[];
  /** Подогнать ширину передней плашки под заднюю (в model space). */
  matchFrontPlateToRear?: boolean;
  /** Ручной множитель передней плашки, если matchFrontPlateToRear выключен. */
  frontPlateScale?: number;
  /** Плоскость с номером сзади (отдельного mesh в GLB нет). */
  rearPlatePlane?: boolean;
  /** Положение задней плоскости по bbox (если нет ниши). */
  rearPlanePlacement?: FixedPlanePlacementConfig;
  /** Mesh для поиска ниши заднего номера (Camry: Paint_Color_BD). */
  rearPocketSourceMesh?: string;
  /** Положение задней плашки — трапециевидная ниша на крышке багажника. */
  rearPlacement?: RearPlatePlacementConfig;
  /** Встроенные плашки GLB — скрыть (заменяются plane или новой текстурой). */
  hiddenPlateMeshNames?: string[];
};

const PLATE_CONFIG_BY_MODEL: Record<string, CarPlateConfig> = {
  "toyota-camry": {
    frontPlateMeshNames: ["Index_0_1_BD_2"],
    matchFrontPlateToRear: true,
    rearPlatePlane: true,
    rearPocketSourceMesh: "Paint_Color_BD",
    rearPlacement: {
      yMinRatio: 0.52,
      yMaxRatio: 0.62,
      widthFactor: 1.667,
      minWidthRatio: 0.638,
      zOffset: 0.003,
      offsetY: -0.002,
    },
  },
  "lada-vesta": {
    frontPlateMeshNames: [],
    frontPlatePlane: true,
    frontPlanePlacement: { xRatio: 0.5, yRatio: 0.2, widthRatio: 0.19, zOffset: 0.004 },
    matchFrontPlateToRear: true,
    rearPlatePlane: true,
    rearPlanePlacement: { xRatio: 0.5, yRatio: 0.36, widthRatio: 0.19, zOffset: 0.004 },
  },
  "vw-polo": {
    frontPlateMeshNames: [],
    frontPlatePlane: true,
    frontPlanePlacement: { xRatio: 0.5, yRatio: 0.14, widthRatio: 0.22, zOffset: 0.004 },
    matchFrontPlateToRear: true,
    rearPlatePlane: true,
    rearPlanePlacement: { xRatio: 0.5, yRatio: 0.25, widthRatio: 0.26, zOffset: 0.006 },
    hiddenPlateMeshNames: [
      "obj01_reg_plate_rear_Text_0",
      "obj01_reg_plate_rear_PLAST_0",
      "obj01_reg_plate_rear.001_Text_0",
      "obj01_reg_plate_rear.001_PLAST_0",
    ],
  },
  "kia-k5": {
    frontPlateMeshNames: [],
    frontPlatePlane: true,
    frontPlanePlacement: { xRatio: 0.5, yRatio: 0.16, widthRatio: 0.16, zOffset: 0.004 },
    matchFrontPlateToRear: true,
    rearPlatePlane: true,
    rearPlanePlacement: { xRatio: 0.5, yRatio: 0.3, widthRatio: 0.16, zOffset: 0.004 },
  },
};

export function getCarPlateConfig(modelId: string): CarPlateConfig | null {
  return PLATE_CONFIG_BY_MODEL[modelId] ?? null;
}

export function registerCarPlateConfig(modelId: string, config: CarPlateConfig): void {
  PLATE_CONFIG_BY_MODEL[modelId] = config;
}

export const DEFAULT_REAR_PLATE_TUNING = {
  sizeScale: 1,
  offsetY: 0,
} as const;

/** Готовый фрагмент `rearPlacement` для вставки в carPlateConfig после подстройки. */
export function formatRearPlateConfigSnippet(
  modelId: string,
  tuning: { sizeScale: number; offsetY: number },
): string | null {
  const config = getCarPlateConfig(modelId);
  const base = config?.rearPlacement;
  if (!base) return null;

  const minWidthRatio = Number(((base.minWidthRatio ?? 0.44) * tuning.sizeScale).toFixed(3));
  const widthFactor = Number(((base.widthFactor ?? 1.15) * tuning.sizeScale).toFixed(3));
  const offsetY = Number(((base.offsetY ?? 0) + tuning.offsetY).toFixed(4));

  const lines = [
    "rearPlacement: {",
    `  yMinRatio: ${base.yMinRatio},`,
    `  yMaxRatio: ${base.yMaxRatio},`,
    `  widthFactor: ${widthFactor},`,
    `  minWidthRatio: ${minWidthRatio},`,
    `  zOffset: ${base.zOffset ?? 0.003},`,
  ];
  if (offsetY !== 0) {
    lines.push(`  offsetY: ${offsetY},`);
  }
  lines.push("},");

  return lines.join("\n");
}
