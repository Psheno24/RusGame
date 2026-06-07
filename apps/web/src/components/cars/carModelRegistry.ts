const MODELS_BASE = "/models/cars";

/** Явное сопоставление id модели из игры → файл GLB. */
const MODEL_FILE_BY_ID: Record<string, string> = {
  "toyota-camry": "camry.glb",
};

function slugFromModelId(modelId: string): string {
  const parts = modelId.split("-");
  return parts[parts.length - 1] ?? modelId;
}

/** Есть ли зарегистрированная 3D-модель для id из каталога. */
export function hasCar3dModel(modelId: string | null | undefined): boolean {
  return Boolean(modelId && modelId in MODEL_FILE_BY_ID);
}

/** Путь к GLB-файлу для id модели автомобиля. */
export function getCarModelPath(modelId: string): string {
  const file = MODEL_FILE_BY_ID[modelId] ?? `${slugFromModelId(modelId)}.glb`;
  return `${MODELS_BASE}/${file}`;
}

/** Зарегистрировать или переопределить путь к 3D-модели. */
export function registerCarModelFile(modelId: string, fileName: string): void {
  MODEL_FILE_BY_ID[modelId] = fileName;
}
