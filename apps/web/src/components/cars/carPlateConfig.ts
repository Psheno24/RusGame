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

export type CarPlateConfig = {
  /** Mesh плашки спереди (текстура на UV). */
  frontPlateMeshNames: string[];
  /** Подогнать ширину передней плашки под заднюю (в model space). */
  matchFrontPlateToRear?: boolean;
  /** Ручной множитель передней плашки, если matchFrontPlateToRear выключен. */
  frontPlateScale?: number;
  /** Плоскость с номером сзади (отдельного mesh в GLB нет). */
  rearPlatePlane?: boolean;
  /** Положение задней плашки — трапециевидная ниша на крышке багажника. */
  rearPlacement?: RearPlatePlacementConfig;
};

const PLATE_CONFIG_BY_MODEL: Record<string, CarPlateConfig> = {
  "toyota-camry": {
    frontPlateMeshNames: ["Index_0_1_BD_2"],
    matchFrontPlateToRear: true,
    rearPlatePlane: true,
    rearPlacement: {
      yMinRatio: 0.52,
      yMaxRatio: 0.62,
      widthFactor: 1.667,
      minWidthRatio: 0.638,
      zOffset: 0.003,
      offsetY: -0.002,
    },
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
