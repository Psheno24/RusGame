import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getCar } from "./gameData.js";
import { DATA_DIR, ROOT } from "./config.js";

const DISPLAY_FILE = join(DATA_DIR, "car-3d-display.json");
const MODELS_DIR = join(ROOT, "apps/web/public/models/cars");

/** Должен совпадать с apps/web carModelRegistry.ts */
const MODEL_FILE_BY_ID: Record<string, string> = {
  "toyota-camry": "camry.glb",
};

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

export type Car3dDisplayStore = Record<string, Car3dDisplayEntry>;

export type Car3dModelListItem = {
  modelId: string;
  brand: string;
  model: string;
  accent: string;
  glbFile: string;
};

function slugFromModelId(modelId: string): string {
  const parts = modelId.split("-");
  return parts[parts.length - 1] ?? modelId;
}

function resolveGlbFile(modelId: string): string {
  return MODEL_FILE_BY_ID[modelId] ?? `${slugFromModelId(modelId)}.glb`;
}

function glbExists(fileName: string): boolean {
  return existsSync(join(MODELS_DIR, fileName));
}

function readStore(): Car3dDisplayStore {
  if (!existsSync(DISPLAY_FILE)) return {};
  try {
    return JSON.parse(readFileSync(DISPLAY_FILE, "utf-8")) as Car3dDisplayStore;
  } catch {
    return {};
  }
}

function writeStore(store: Car3dDisplayStore): void {
  writeFileSync(DISPLAY_FILE, `${JSON.stringify(store, null, 2)}\n`, "utf-8");
}

export function listCar3dModels(): Car3dModelListItem[] {
  const availableGlbs = new Set(
    existsSync(MODELS_DIR)
      ? readdirSync(MODELS_DIR).filter((name) => name.endsWith(".glb"))
      : [],
  );

  const seen = new Set<string>();
  const items: Car3dModelListItem[] = [];

  for (const modelId of Object.keys(MODEL_FILE_BY_ID)) {
    const glbFile = resolveGlbFile(modelId);
    if (!availableGlbs.has(glbFile)) continue;
    const car = getCar(modelId);
    if (!car) continue;
    seen.add(modelId);
    items.push({
      modelId,
      brand: car.brand,
      model: car.model,
      accent: car.accent,
      glbFile,
    });
  }

  for (const glbFile of availableGlbs) {
    const modelId =
      Object.entries(MODEL_FILE_BY_ID).find(([, file]) => file === glbFile)?.[0] ??
      glbFile.replace(/\.glb$/, "");
    if (seen.has(modelId)) continue;
    const car = getCar(modelId);
    if (!car) continue;
    items.push({
      modelId,
      brand: car.brand,
      model: car.model,
      accent: car.accent,
      glbFile,
    });
  }

  items.sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, "ru"));
  return items;
}

export function getCar3dDisplay(modelId: string): Car3dDisplayEntry | null {
  return readStore()[modelId] ?? null;
}

export function getAllCar3dDisplay(): Car3dDisplayStore {
  return readStore();
}

export function saveCar3dDisplay(modelId: string, patch: Car3dDisplayEntry): Car3dDisplayEntry {
  const glbFile = resolveGlbFile(modelId);
  if (!glbExists(glbFile)) {
    throw new Error("3D-модель не найдена");
  }
  if (!getCar(modelId)) {
    throw new Error("Машина не найдена в каталоге");
  }

  const store = readStore();
  const prev = store[modelId] ?? {};
  const next: Car3dDisplayEntry = {
    plate: patch.plate ?? prev.plate,
    card: patch.card ?? prev.card,
  };
  store[modelId] = next;
  writeStore(store);
  return next;
}
