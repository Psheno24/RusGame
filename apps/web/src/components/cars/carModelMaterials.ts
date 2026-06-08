import {
  Box3,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SRGBColorSpace,
  Vector3,
} from "three";
import { getModelBodyBoxWorld } from "./carModelBodyBox";
import { DEFAULT_CAR_BODY_COLOR } from "./carBodyColors";

type ModelMaterialRules = {
  glassMaterialNames?: string[];
  headlightMaterialNames?: string[];
};

const MATERIAL_RULES_BY_MODEL: Record<string, ModelMaterialRules> = {
  "vw-polo": {
    glassMaterialNames: ["GLASS_WINDOW"],
    headlightMaterialNames: ["FARA_LAMP"],
  },
};

function hasBaseColorMap(mat: MeshStandardMaterial): boolean {
  return mat.map != null;
}

function applyVestaGlass(mat: MeshStandardMaterial): void {
  if (hasBaseColorMap(mat)) return;

  mat.metalness = 0.02;
  mat.roughness = 0.08;
  mat.transparent = true;
  mat.opacity = 0.38;
  mat.color.setRGB(0.1, 0.12, 0.16);
  mat.depthWrite = false;
  mat.needsUpdate = true;
}

function fixDeadHeadlight(mat: MeshStandardMaterial): void {
  if (hasBaseColorMap(mat)) return;

  mat.metalness = 0.08;
  mat.roughness = 0.12;
  mat.color.setRGB(0.88, 0.9, 0.93);
  mat.emissive.setRGB(0.9, 0.92, 0.96);
  mat.emissiveIntensity = Math.max(mat.emissiveIntensity ?? 0, 1.4);
  mat.needsUpdate = true;
}

function fixTintedGlassGeneric(mat: MeshStandardMaterial): void {
  if (hasBaseColorMap(mat)) return;

  mat.transparent = true;
  if (mat.opacity >= 0.99) mat.opacity = 0.45;
  const lum = mat.color.r * 0.299 + mat.color.g * 0.587 + mat.color.b * 0.114;
  if (lum < 0.2) {
    mat.color.r = Math.min(1, mat.color.r * 2.2 + 0.08);
    mat.color.g = Math.min(1, mat.color.g * 2.2 + 0.08);
    mat.color.b = Math.min(1, mat.color.b * 2.2 + 0.1);
  }
  mat.metalness = Math.min(mat.metalness, 0.2);
  mat.roughness = Math.max(mat.roughness, 0.08);
  mat.depthWrite = false;
  mat.needsUpdate = true;
}

/** Lada Vesta: metalness=1 без env map даёт чёрные «зеркала» на стёклах и фарах. */
function enhanceVestaMaterials(root: Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of materials) {
      if (!(mat instanceof MeshStandardMaterial)) continue;

      switch (mat.name) {
        case "steklo":
        case "stekloton":
          applyVestaGlass(mat);
          break;
        case "PeredFar":
          fixDeadHeadlight(mat);
          break;
        case "Fari":
          mat.metalness = 0.1;
          mat.roughness = 0.15;
          mat.emissiveIntensity = Math.max(mat.emissiveIntensity ?? 0, 2.5);
          mat.needsUpdate = true;
          break;
        case "Material_1529":
          // Полупрозрачная накладка — меньше opacity, чтобы фонари не «мутнили»
          mat.metalness = 0.02;
          mat.roughness = 0.12;
          mat.transparent = true;
          mat.opacity = 0.14;
          mat.color.setRGB(0.45, 0.05, 0.05);
          mat.emissive.setRGB(0, 0, 0);
          mat.emissiveIntensity = 0;
          mat.depthWrite = false;
          mat.needsUpdate = true;
          break;
        case "Material_1605":
        case "Material_1603":
        case "stopar":
          mat.metalness = 0.05;
          mat.roughness = Math.max(mat.roughness, 0.1);
          mat.emissiveIntensity = Math.max(mat.emissiveIntensity ?? 0, 3.5);
          mat.needsUpdate = true;
          break;
        default:
          break;
      }
    }
  });
}

function applyK5WindowGlass(mat: MeshStandardMaterial): void {
  mat.metalness = 0.02;
  mat.roughness = 0.06;
  mat.transparent = true;
  mat.opacity = 0.32;
  mat.color.setRGB(0.07, 0.09, 0.13);
  mat.depthWrite = false;
  mat.side = DoubleSide;
  mat.needsUpdate = true;
}

function applyK5BodyPaint(mat: MeshStandardMaterial, bodyColor: string): void {
  mat.map = null;
  mat.color.set(bodyColor);
  mat.metalness = 0.42;
  mat.roughness = 0.24;
  mat.emissive.setRGB(0, 0, 0);
  mat.emissiveIntensity = 0;
  mat.transparent = false;
  mat.opacity = 1;
  mat.depthWrite = true;
  mat.flatShading = false;
  mat.envMapIntensity = 1.2;
  mat.needsUpdate = true;
}

/** Явный список кузовных панелей (капот, багажник, крыша…) — любой mat. */
const K5_BODY_PANEL_MESH_NAMES = new Set([
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
]);

/** Белые «безымянные» дворники в GLB. */
const K5_WIPER_MESH_NAMES = new Set(["mesh_75"]);

function isK5MisclassifiedBodyPanel(mesh: Mesh, materialName: string): boolean {
  if (K5_BODY_PANEL_MESH_NAMES.has(mesh.name)) return true;
  return materialName === "insta_ua1k.006";
}

function shouldPaintK5Mesh(child: Mesh, mat: MeshStandardMaterial): boolean {
  if (K5_REAR_TAIL_LIGHT_MESHES.has(child.name)) return false;
  if (K5_BODY_PANEL_MESH_NAMES.has(child.name)) return true;
  if (mat.name === "insta_ua1k" || mat.name === "insta_ua1k.005" || mat.name === "insta_ua1k.009" || mat.name === "insta_ua1k.010") {
    return true;
  }
  if (mat.name === "insta_ua1k.006") return true;
  return isK5MisclassifiedBodyPanel(child, mat.name);
}

/** Единая белая/цветная краска на все панели кузова K5. */
function applyK5BodyPaintColor(root: Object3D, bodyColor: string): void {
  root.traverse((child) => {
    if (!(child instanceof Mesh) || !child.visible) return;
    if (K5_WHEEL_MESH_NAMES.has(child.name)) return;
    if (K5_TRIM_MESH_NAMES.has(child.name)) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (let i = 0; i < materials.length; i++) {
      const mat = materials[i];
      if (!(mat instanceof MeshStandardMaterial)) continue;
      if (!shouldPaintK5Mesh(child, mat)) continue;
      const painted = mat.clone();
      painted.name = mat.name;
      applyK5BodyPaint(painted, bodyColor);
      if (Array.isArray(child.material)) {
        child.material[i] = painted;
      } else {
        child.material = painted;
      }
    }
  });
}

const _k5Box = new Box3();
const _k5Center = new Vector3();
const _k5Size = new Vector3();

function getMeshWorldCenter(mesh: Mesh): Vector3 {
  mesh.updateMatrixWorld(true);
  _k5Box.setFromObject(mesh);
  return _k5Box.getCenter(_k5Center);
}

function isK5WheelZone(center: Vector3, body: Box3): boolean {
  const size = body.getSize(_k5Size);
  const ry = (center.y - body.min.y) / (size.y || 1);
  const rz = (center.z - body.min.z) / (size.z || 1);
  return ry < 0.24 && (rz > 0.72 || rz < 0.3);
}

function isK5FrontLightZone(center: Vector3, body: Box3): boolean {
  const size = body.getSize(_k5Size);
  const ry = (center.y - body.min.y) / (size.y || 1);
  const rz = (center.z - body.min.z) / (size.z || 1);
  const rx =
    Math.abs(center.x - (body.min.x + body.max.x) * 0.5) / ((size.x * 0.5) || 1);
  return rz > 0.68 && ry > 0.1 && ry < 0.72 && rx < 0.85;
}

function isK5RearReverseZone(center: Vector3, body: Box3): boolean {
  const size = body.getSize(_k5Size);
  const ry = (center.y - body.min.y) / (size.y || 1);
  const rz = (center.z - body.min.z) / (size.z || 1);
  return rz < 0.15 && ry > 0.15 && ry <= 0.32;
}

function applyK5WheelRubber(mat: MeshStandardMaterial): void {
  mat.map = null;
  mat.normalMap = null;
  mat.roughnessMap = null;
  mat.metalnessMap = null;
  mat.color.setRGB(0.05, 0.05, 0.05);
  mat.metalness = 0.02;
  mat.roughness = 0.92;
  mat.emissive.setRGB(0, 0, 0);
  mat.emissiveIntensity = 0;
  mat.needsUpdate = true;
}

function applyK5WheelRim(mat: MeshStandardMaterial): void {
  mat.map = null;
  mat.color.setRGB(0.52, 0.53, 0.55);
  mat.metalness = 0.88;
  mat.roughness = 0.24;
  mat.emissive.setRGB(0, 0, 0);
  mat.emissiveIntensity = 0;
  mat.needsUpdate = true;
}

function applyK5BumperPlastic(mat: MeshStandardMaterial): void {
  mat.transparent = false;
  mat.opacity = 1;
  mat.depthWrite = true;
  mat.color.setRGB(0.11, 0.11, 0.12);
  mat.metalness = 0.12;
  mat.roughness = 0.58;
  mat.emissive.setRGB(0, 0, 0);
  mat.emissiveIntensity = 0;
  mat.needsUpdate = true;
}

function applyK5NeutralPlastic(mat: MeshStandardMaterial): void {
  mat.transparent = false;
  mat.opacity = 1;
  mat.depthWrite = true;
  mat.color.setRGB(0.14, 0.14, 0.15);
  mat.metalness = 0.08;
  mat.roughness = 0.55;
  mat.emissive.setRGB(0, 0, 0);
  mat.emissiveIntensity = 0;
  mat.needsUpdate = true;
}
function applyK5FrontLightBezel(mat: MeshStandardMaterial): void {
  mat.transparent = false;
  mat.opacity = 1;
  mat.color.setRGB(0.07, 0.07, 0.08);
  mat.metalness = 0.78;
  mat.roughness = 0.34;
  mat.emissive.setRGB(0, 0, 0);
  mat.emissiveIntensity = 0;
  mat.needsUpdate = true;
}

function applyK5FrontDrl(mat: MeshStandardMaterial): void {
  mat.transparent = false;
  mat.opacity = 1;
  mat.color.setRGB(0.95, 0.97, 1);
  mat.metalness = 0.04;
  mat.roughness = 0.1;
  mat.emissive.setRGB(0.92, 0.95, 1);
  mat.emissiveIntensity = 4.5;
  mat.needsUpdate = true;
}

function applyK5FrontLight(mat: MeshStandardMaterial, isLens: boolean): void {
  if (isLens) {
    mat.transparent = true;
    mat.opacity = 0.16;
    mat.color.setRGB(0.94, 0.96, 0.98);
    mat.metalness = 0.02;
    mat.roughness = 0.04;
    mat.emissive.setRGB(0, 0, 0);
    mat.emissiveIntensity = 0;
    mat.depthWrite = false;
    mat.side = DoubleSide;
  } else {
    mat.transparent = false;
    mat.opacity = 1;
    mat.color.setRGB(0.98, 0.99, 1);
    mat.metalness = 0.02;
    mat.roughness = 0.12;
    mat.emissive.setRGB(0.95, 0.97, 1);
    mat.emissiveIntensity = 5.5;
  }
  mat.needsUpdate = true;
}

function applyK5RearReflector(mat: MeshStandardMaterial): void {
  mat.transparent = false;
  mat.opacity = 1;
  mat.color.setRGB(0.88, 0.12, 0.09);
  mat.metalness = 0.05;
  mat.roughness = 0.12;
  mat.emissive.setRGB(1, 0.15, 0.1);
  mat.emissiveIntensity = 4.2;
  mat.needsUpdate = true;
}

function applyK5RearTailLight(mat: MeshStandardMaterial, isLens: boolean): void {
  if (isLens) {
    mat.transparent = true;
    mat.opacity = 0.14;
    mat.color.setRGB(0.94, 0.96, 0.98);
    mat.metalness = 0.02;
    mat.roughness = 0.04;
    mat.emissive.setRGB(0, 0, 0);
    mat.emissiveIntensity = 0;
    mat.depthWrite = false;
    mat.side = DoubleSide;
  } else {
    mat.transparent = false;
    mat.opacity = 1;
    mat.color.setRGB(0.95, 0.14, 0.1);
    mat.metalness = 0.02;
    mat.roughness = 0.12;
    mat.emissive.setRGB(1, 0.18, 0.12);
    mat.emissiveIntensity = 5.5;
  }
  mat.needsUpdate = true;
}

function applyK5RearReverseLight(mat: MeshStandardMaterial): void {
  mat.metalness = 0.05;
  mat.roughness = 0.12;
  mat.transparent = false;
  mat.opacity = 1;
  mat.color.setRGB(0.9, 0.92, 0.95);
  mat.emissive.setRGB(0.95, 0.97, 1);
  mat.emissiveIntensity = 2.8;
  mat.needsUpdate = true;
}

function applyK5TurnSignal(mat: MeshStandardMaterial): void {
  mat.metalness = 0.05;
  mat.roughness = 0.14;
  mat.emissive.setRGB(1, 0.5, 0.05);
  mat.emissiveIntensity = 2.6;
  mat.needsUpdate = true;
}

function cloneMeshMaterials(mesh: Mesh): MeshStandardMaterial[] {
  const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const cloned = source.map((mat) =>
    mat instanceof MeshStandardMaterial ? mat.clone() : mat,
  );
  mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]!;
  return cloned.filter((mat): mat is MeshStandardMaterial => mat instanceof MeshStandardMaterial);
}

/** Только реальные лампы/хром — не бампер (mesh_50/55 обрабатываются как trim). */
const K5_REAR_TAIL_LIGHT_MESHES = new Set([
  "mesh_22",
  "mesh_23",
  "mesh_24",
  "mesh_25",
  "mesh_26",
  "mesh_27",
  "mesh_28",
  "mesh_49",
  "mesh_51",
  "mesh_52",
  "mesh_53",
]);

/** Ободок вокруг задней лампы — непрозрачный, как спереди. */
const K5_REAR_LIGHT_BEZEL_MESHES = new Set(["mesh_50"]);

function enhanceK5MeshLights(mesh: Mesh, bodyWorld: Box3): void {
  const center = getMeshWorldCenter(mesh);
  const materials = cloneMeshMaterials(mesh);
  const isTire = K5_TIRE_MESH_NAMES.has(mesh.name);
  const isRim = K5_RIM_MESH_NAMES.has(mesh.name);
  const inFront = isK5FrontLightZone(center, bodyWorld);
  const isRearLight = K5_REAR_TAIL_LIGHT_MESHES.has(mesh.name);

  if (K5_TRIM_MESH_NAMES.has(mesh.name)) {
    for (const mat of materials) {
      if (!(mat instanceof MeshStandardMaterial)) continue;
      if (K5_REAR_LIGHT_BEZEL_MESHES.has(mesh.name)) {
        applyK5FrontLightBezel(mat);
      } else {
        applyK5BumperPlastic(mat);
      }
    }
    return;
  }

  if (K5_WIPER_MESH_NAMES.has(mesh.name)) {
    for (const mat of materials) {
      if (!(mat instanceof MeshStandardMaterial)) continue;
      applyK5BumperPlastic(mat);
    }
    return;
  }

  if (K5_BODY_PANEL_MESH_NAMES.has(mesh.name)) return;

  for (const mat of materials) {
    let handled = false;

    if (isTire || (isK5WheelZone(center, bodyWorld) && !mat.name && !isRim)) {
      applyK5WheelRubber(mat);
      continue;
    }

    if (isRim || mat.name === "wheels.6") {
      applyK5WheelRim(mat);
      continue;
    }

    const isLens = mat.name === "insta_ua1k.008";
    const isLightCore = mat.name === "insta_ua1k.006";
    const isBodyPanel = isK5MisclassifiedBodyPanel(mesh, mat.name);

    if (mat.map) {
      if (inFront) {
        mat.emissive.setRGB(0.92, 0.95, 1);
        mat.emissiveIntensity = Math.max(mat.emissiveIntensity ?? 0, 3.5);
        mat.metalness = Math.min(mat.metalness, 0.1);
        mat.needsUpdate = true;
      } else if (isRearLight) {
        mat.emissive.setRGB(0.95, 0.12, 0.09);
        mat.emissiveIntensity = Math.max(mat.emissiveIntensity ?? 0, 3);
        mat.metalness = Math.min(mat.metalness, 0.1);
        mat.needsUpdate = true;
      }
      continue;
    }

    if (mat.name === "insta_ua1k.011") {
      applyK5TurnSignal(mat);
      mesh.renderOrder = 3;
      continue;
    }

    if (inFront && !isBodyPanel) {
      if (isLens) {
        applyK5FrontLight(mat, true);
        mesh.renderOrder = 4;
        handled = true;
      } else if (isLightCore) {
        applyK5FrontLight(mat, false);
        mesh.renderOrder = 2;
        handled = true;
      } else if (mat.name === "insta_ua1k.005") {
        applyK5FrontLightBezel(mat);
        handled = true;
      } else if (mat.name === "insta_ua1k.002") {
        applyK5FrontDrl(mat);
        mesh.renderOrder = 2;
        handled = true;
      }
    }

    if (!handled && isRearLight && !isBodyPanel) {
      if (isLens) {
        applyK5RearTailLight(mat, true);
        mesh.renderOrder = 4;
        handled = true;
      } else if (isLightCore) {
        applyK5RearTailLight(mat, false);
        mesh.renderOrder = 2;
        handled = true;
      } else if (mat.name === "insta_ua1k.002") {
        applyK5RearReflector(mat);
        mesh.renderOrder = 2;
        handled = true;
      } else if (mat.name === "insta_ua1k.004") {
        mat.color.setRGB(0.72, 0.73, 0.75);
        mat.metalness = 0.88;
        mat.roughness = 0.2;
        mat.emissive.setRGB(0, 0, 0);
        mat.emissiveIntensity = 0;
        mat.needsUpdate = true;
        handled = true;
      }
    }

    if (!handled && isK5RearReverseZone(center, bodyWorld) && isLightCore && !isBodyPanel) {
      applyK5RearReverseLight(mat);
      mesh.renderOrder = 3;
      handled = true;
    }

    if (!handled && mat.name === "insta_ua1k.006") {
      applyK5NeutralPlastic(mat);
    } else if (!handled && mat.name === "insta_ua1k.002") {
      applyK5NeutralPlastic(mat);
    }
  }
}

function ensureTexturedMaterials(root: Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof Mesh) || !child.visible) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of materials) {
      if (!(mat instanceof MeshStandardMaterial) || !mat.map) continue;
      mat.map.colorSpace = SRGBColorSpace;
      mat.metalness = Math.min(mat.metalness, 0.35);
      mat.roughness = Math.max(mat.roughness, 0.15);
      mat.envMapIntensity = 1;
      mat.needsUpdate = true;
    }
  });
}

/** Мусор из исходного GLB: рамки, оси, бейджи. Шины — mesh_1/2/6/8/9/10, не скрываем. */
const K5_HIDDEN_MESH_NAMES = new Set([
  "mesh_3",
  "mesh_4",
  "mesh_5",
  "mesh_76",
  "mesh_75",
  "mesh_77",
]);

const K5_TIRE_MESH_NAMES = new Set([
  "mesh_1",
  "mesh_2",
  "mesh_6",
  "mesh_8",
  "mesh_9",
  "mesh_10",
]);

const K5_RIM_MESH_NAMES = new Set(["mesh_0", "mesh_7"]);

const K5_WHEEL_MESH_NAMES = new Set([...K5_TIRE_MESH_NAMES, ...K5_RIM_MESH_NAMES]);

/** insta_ua1k.005 — мелкий пластик/бампер; остальные .005 — основные панели кузова. */
const K5_TRIM_MESH_NAMES = new Set([
  "mesh_13",
  "mesh_14",
  "mesh_18",
  "mesh_40",
  "mesh_46",
  "mesh_50",
  "mesh_55",
]);

function smoothK5Surfaces(root: Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const geometry = child.geometry;
    if (geometry && !geometry.userData.__k5_normals__) {
      geometry.computeVertexNormals();
      geometry.userData.__k5_normals__ = true;
    }
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of materials) {
      if (!(mat instanceof MeshStandardMaterial)) continue;
      mat.flatShading = false;
      mat.needsUpdate = true;
    }
  });
}

function hideK5ArtifactMeshes(root: Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    if (K5_HIDDEN_MESH_NAMES.has(child.name)) {
      child.visible = false;
      return;
    }

    if (K5_WHEEL_MESH_NAMES.has(child.name)) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of materials) {
      if (!(mat instanceof MeshStandardMaterial)) continue;
      if (!mat.name && mat.map) {
        child.visible = false;
        return;
      }
    }
  });
}

/** K5: стёкла — insta_ua1k.007; фары/фонари — по mesh + зоне (world bbox). */
function enhanceK5Materials(root: Object3D, bodyColor = DEFAULT_CAR_BODY_COLOR): void {
  smoothK5Surfaces(root);
  hideK5ArtifactMeshes(root);
  const bodyWorld = getModelBodyBoxWorld(root);

  root.traverse((child) => {
    if (!(child instanceof Mesh) || !child.visible) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of materials) {
      if (!(mat instanceof MeshStandardMaterial) || mat.map) continue;
      if (mat.name === "insta_ua1k.007") {
        applyK5WindowGlass(mat);
      } else if (
        mat.name === "insta_ua1k.004" ||
        mat.name === "insta_ua1k.001" ||
        mat.name === "insta_ua1k.003"
      ) {
        mat.metalness = 0.82;
        mat.roughness = 0.16;
        mat.needsUpdate = true;
      }
    }
    enhanceK5MeshLights(child, bodyWorld);
  });

  ensureTexturedMaterials(root);
  applyK5BodyPaintColor(root, bodyColor);
}

/** Точечные правки материалов GLB, где расширения glTF не отрабатывают. */
export function enhanceCarMaterials(
  root: Object3D,
  modelId?: string,
  bodyColor?: string | null,
): void {
  if (!modelId) return;

  if (modelId === "lada-vesta") {
    enhanceVestaMaterials(root);
    return;
  }

  if (modelId === "kia-k5") {
    enhanceK5Materials(root, bodyColor ?? DEFAULT_CAR_BODY_COLOR);
    return;
  }

  const rules = MATERIAL_RULES_BY_MODEL[modelId];
  if (!rules) return;

  const glassSet = new Set(rules.glassMaterialNames ?? []);
  const lightSet = new Set(rules.headlightMaterialNames ?? []);

  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of materials) {
      if (!(mat instanceof MeshStandardMaterial)) continue;
      if (glassSet.has(mat.name)) {
        fixTintedGlassGeneric(mat);
      } else if (lightSet.has(mat.name)) {
        fixDeadHeadlight(mat);
      }
    }
  });
}
