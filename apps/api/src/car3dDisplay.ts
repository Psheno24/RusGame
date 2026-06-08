import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getCar } from "./gameData.js";
import { DATA_DIR, ROOT } from "./config.js";

const DISPLAY_FILE = join(DATA_DIR, "car-3d-display.json");

/** Локально — public; в Docker/production после `vite build` — dist. */
function getCarModelsDirs(): string[] {
  const candidates = [
    process.env.CAR_MODELS_DIR,
    join(ROOT, "apps/web/dist/models/cars"),
    join(ROOT, "apps/web/public/models/cars"),
  ].filter((dir): dir is string => Boolean(dir));
  return [...new Set(candidates)].filter((dir) => existsSync(dir));
}

/** Должен совпадать с apps/web carModelRegistry.ts */
const MODEL_FILE_BY_ID: Record<string, string> = {
  "toyota-camry": "camry.glb",
  "lada-vesta": "lada_vesta.glb",
  "vw-polo": "volkswagen_polo.glb",
  "kia-k5": "kia_optima_k5.glb",
};

export type CarPlateFaceTuning = {
  offsetX: number;
  offsetY: number;
  flipX?: boolean;
  flipY?: boolean;
};

/** @deprecated Используйте CarPlateFaceTuning */
export type CarPlateAxisOffsets = CarPlateFaceTuning;

export type CarPlateDisplayTuning = {
  sizeScale: number;
  front: CarPlateFaceTuning;
  rear: CarPlateFaceTuning;
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

function listAvailableGlbs(): Set<string> {
  const names = new Set<string>();
  for (const dir of getCarModelsDirs()) {
    for (const name of readdirSync(dir)) {
      if (name.endsWith(".glb")) names.add(name);
    }
  }
  return names;
}

function glbExists(fileName: string): boolean {
  return getCarModelsDirs().some((dir) => existsSync(join(dir, fileName)));
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
  const availableGlbs = listAvailableGlbs();

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
