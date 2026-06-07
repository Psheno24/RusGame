import {
  Color,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from "three";

function isPbrMaterial(mat: Material): mat is MeshStandardMaterial {
  return mat instanceof MeshStandardMaterial;
}

export type CarMeshInfo = {
  name: string;
  materialNames: string[];
  materialTypes: string[];
};

export type CarMaterialInfo = {
  name: string;
  type: string;
  color: string | null;
  meshNames: string[];
};

export type CarModelInspection = {
  modelId?: string;
  modelPath: string;
  meshes: CarMeshInfo[];
  materials: CarMaterialInfo[];
};

/**
 * Конфигурация перекраски кузова.
 * После инспекции GLB заполните bodyMaterialNames и/или bodyMeshNames.
 */
export type CarBodyColorConfig = {
  bodyMaterialNames?: string[];
  bodyMeshNames?: string[];
};

export const DEFAULT_BODY_COLOR_CONFIG: CarBodyColorConfig = {
  bodyMaterialNames: [],
  bodyMeshNames: [],
};

function materialLabel(mat: Material): string {
  return mat.name || "(unnamed)";
}

function materialColorHex(mat: Material): string | null {
  if ("color" in mat && mat.color instanceof Color) {
    return `#${mat.color.getHexString()}`;
  }
  return null;
}

function collectMaterials(mesh: Mesh): Material[] {
  if (Array.isArray(mesh.material)) {
    return mesh.material;
  }
  return mesh.material ? [mesh.material] : [];
}

/** Вывести в консоль mesh-объекты и материалы модели для определения кузова. */
export function inspectCarModel(
  root: Object3D,
  modelPath: string,
  modelId?: string,
): CarModelInspection {
  const meshMap = new Map<string, CarMeshInfo>();
  const materialMap = new Map<string, CarMaterialInfo>();

  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;

    const meshName = child.name || "(unnamed mesh)";
    const mats = collectMaterials(child);
    const materialNames = mats.map(materialLabel);
    const materialTypes = mats.map((m) => m.type);

    meshMap.set(meshName, { name: meshName, materialNames, materialTypes });

    mats.forEach((mat) => {
      const key = materialLabel(mat);
      const existing = materialMap.get(key);
      if (existing) {
        if (!existing.meshNames.includes(meshName)) {
          existing.meshNames.push(meshName);
        }
        return;
      }
      materialMap.set(key, {
        name: key,
        type: mat.type,
        color: materialColorHex(mat),
        meshNames: [meshName],
      });
    });
  });

  const inspection: CarModelInspection = {
    modelId,
    modelPath,
    meshes: [...meshMap.values()],
    materials: [...materialMap.values()],
  };

  console.group(`[CarModel] ${modelId ?? modelPath}`);
  console.log("Meshes:", inspection.meshes);
  console.log("Materials:", inspection.materials);
  console.groupEnd();

  return inspection;
}

function matchesBodyTarget(
  meshName: string,
  materialName: string,
  config: CarBodyColorConfig,
): boolean {
  if (config.bodyMeshNames?.includes(meshName)) return true;
  if (config.bodyMaterialNames?.includes(materialName)) return true;
  return false;
}

function applyColorToMaterial(mat: MeshStandardMaterial, color: Color): void {
  mat.color.copy(color);
  // Убираем текстуру базового цвета — иначе новый цвет смешивается с оригинальной краской.
  mat.map = null;
  mat.needsUpdate = true;
}

/** Применить цвет кузова (активируется после заполнения CarBodyColorConfig). */
export function applyBodyColor(
  root: Object3D,
  color: string,
  config: CarBodyColorConfig = DEFAULT_BODY_COLOR_CONFIG,
): boolean {
  const hasTargets =
    (config.bodyMaterialNames?.length ?? 0) > 0 ||
    (config.bodyMeshNames?.length ?? 0) > 0;

  if (!hasTargets) return false;

  const next = new Color(color);
  let applied = false;

  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const meshName = child.name || "(unnamed mesh)";

    collectMaterials(child).forEach((mat) => {
      const materialName = materialLabel(mat);
      if (!matchesBodyTarget(meshName, materialName, config)) return;
      if (!isPbrMaterial(mat)) return;
      applyColorToMaterial(mat, next);
      applied = true;
    });
  });

  return applied;
}
