import {
  Box3,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
} from "three";
import type { VehiclePlateParts } from "../../api";
import { drawPlateToCanvas, PLATE_SVG_HEIGHT, PLATE_SVG_WIDTH } from "../../plateSvgMarkup";
import type { CarPlateConfig, FixedPlanePlacementConfig, RearPlatePlacementConfig } from "./carPlateConfig";
import type { CarPlateDisplayTuning, CarPlateFaceTuning } from "./carDisplayConfig";
import { PLATE_OFFSET_SLIDER_UNIT } from "./carDisplayConfig";
import type { CarRearPlateTuning } from "./types";
import {
  getModelBodyBoxLocal,
  getModelBodyBoxWorld,
  primeModelBodyBox,
} from "./carModelBodyBox";

export { primeModelBodyBox };

const PLATE_FONT_URL = "/fonts/gost-plate.ttf";
const TEXTURE_SCALE = 2;
const REAR_PLATE_OBJECT_NAME = "__car_rear_plate__";
const FRONT_PLATE_OBJECT_NAME = "__car_front_plate__";
const DEFAULT_REAR_POCKET_SOURCE_MESH = "Paint_Color_BD";
const FRONT_PLATE_ORIGINAL_POSITIONS_KEY = "__car_front_plate_orig_pos__";
const _plateCenter = new Vector3();
const _plateSize = { width: 0.1, height: 0.05 };

function measureOriginalPlateSize(original: Float32Array, count: number): { width: number; height: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < count; i++) {
    const x = original[i * 3];
    const y = original[i * 3 + 1];
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  return {
    width: maxX - minX || 0.1,
    height: maxY - minY || 0.05,
  };
}

let fontReady: Promise<void> | null = null;

async function ensurePlateFont(): Promise<void> {
  if (fontReady) return fontReady;
  if (typeof document === "undefined") {
    fontReady = Promise.resolve();
    return fontReady;
  }

  fontReady = (async () => {
    try {
      const face = new FontFace("GostPlate", `url(${PLATE_FONT_URL})`, { weight: "400" });
      await face.load();
      document.fonts.add(face);
    } catch {
      // fallback fonts
    }
    await document.fonts.load(`700 72px GostPlate, Arial, sans-serif`).catch(() => undefined);
  })();

  return fontReady;
}

/** UV плашки в GLB — узкая полоска атласа; растягиваем на весь 0…1 под нашу текстуру. */
export function normalizePlateMeshUVs(geometry: BufferGeometry): void {
  const uv = geometry.attributes.uv;
  if (!uv) return;

  let uMin = Infinity;
  let uMax = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;

  for (let i = 0; i < uv.count; i++) {
    uMin = Math.min(uMin, uv.getX(i));
    uMax = Math.max(uMax, uv.getX(i));
    vMin = Math.min(vMin, uv.getY(i));
    vMax = Math.max(vMax, uv.getY(i));
  }

  const du = uMax - uMin || 1;
  const dv = vMax - vMin || 1;

  for (let i = 0; i < uv.count; i++) {
    const u = (uv.getX(i) - uMin) / du;
    const v = (uv.getY(i) - vMin) / dv;
    uv.setXY(i, u, v);
  }

  uv.needsUpdate = true;
}

async function rasterizePlate(parts: VehiclePlateParts): Promise<HTMLCanvasElement> {
  await ensurePlateFont();

  const scale = TEXTURE_SCALE;
  const canvas = document.createElement("canvas");
  canvas.width = PLATE_SVG_WIDTH * scale;
  canvas.height = PLATE_SVG_HEIGHT * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  drawPlateToCanvas(ctx, parts, scale);
  return canvas;
}

export async function createPlateCanvasTexture(
  parts: VehiclePlateParts,
): Promise<CanvasTexture> {
  const canvas = await rasterizePlate(parts);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

function findMesh(root: Object3D, name: string): Mesh | null {
  let found: Mesh | null = null;
  root.traverse((child) => {
    if (found) return;
    if (child instanceof Mesh && child.name === name) found = child;
  });
  return found;
}

function hidePlateMeshes(root: Object3D, meshNames?: string[]): void {
  if (!meshNames?.length) return;
  for (const name of meshNames) {
    const mesh = findMesh(root, name);
    if (mesh) mesh.visible = false;
  }
}

function createPlateMaterial(texture: CanvasTexture, emissiveIntensity = 0.35): MeshStandardMaterial {
  return new MeshStandardMaterial({
    map: texture,
    color: new Color(0xffffff),
    emissive: new Color(0xffffff),
    emissiveMap: texture,
    emissiveIntensity,
    metalness: 0,
    roughness: 0.85,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
}

/** Текстура для плоскости: фиксированный flipY по стороне (не зависит от настроек). */
function createFacePlaneTexture(source: CanvasTexture, face: "front" | "rear"): CanvasTexture {
  const tex = source.clone();
  tex.flipY = face === "rear";
  tex.needsUpdate = true;
  return tex;
}

function getPlaneScale(face: "front" | "rear", tuning?: CarPlateFaceTuning): { x: number; y: number } {
  let x = face === "rear" ? -1 : 1;
  let y = 1;
  if (tuning?.flipX) x *= -1;
  if (tuning?.flipY) y *= -1;
  return { x, y };
}

function flipPlateUVs(geometry: BufferGeometry, flipX: boolean, flipY: boolean): void {
  if (!flipX && !flipY) return;
  const uv = geometry.attributes.uv;
  if (!uv) return;

  for (let i = 0; i < uv.count; i++) {
    let u = uv.getX(i);
    let v = uv.getY(i);
    if (flipX) u = 1 - u;
    if (flipY) v = 1 - v;
    uv.setXY(i, u, v);
  }

  uv.needsUpdate = true;
}

/** Масштаб и смещение геометрии вокруг центра — без смещения pivot (в отличие от mesh.scale). */
function applyFrontPlateGeometry(
  mesh: Mesh,
  scale: number,
  tuning?: CarPlateFaceTuning,
): void {
  const pos = mesh.geometry.attributes.position;
  if (!pos) return;

  if (!mesh.userData[FRONT_PLATE_ORIGINAL_POSITIONS_KEY]) {
    mesh.userData[FRONT_PLATE_ORIGINAL_POSITIONS_KEY] = new Float32Array(pos.array);
  }

  const original = mesh.userData[FRONT_PLATE_ORIGINAL_POSITIONS_KEY] as Float32Array;
  const count = pos.count;
  const plateSize = measureOriginalPlateSize(original, count);
  const dx = (tuning?.offsetX ?? 0) * plateSize.width * PLATE_OFFSET_SLIDER_UNIT;
  const dy = (tuning?.offsetY ?? 0) * plateSize.height * PLATE_OFFSET_SLIDER_UNIT;

  _plateCenter.set(0, 0, 0);
  for (let i = 0; i < count; i++) {
    _plateCenter.x += original[i * 3];
    _plateCenter.y += original[i * 3 + 1];
    _plateCenter.z += original[i * 3 + 2];
  }
  _plateCenter.multiplyScalar(1 / count);

  for (let i = 0; i < count; i++) {
    pos.setXYZ(
      i,
      _plateCenter.x + (original[i * 3] - _plateCenter.x) * scale + dx,
      _plateCenter.y + (original[i * 3 + 1] - _plateCenter.y) * scale + dy,
      _plateCenter.z + (original[i * 3 + 2] - _plateCenter.z) * scale,
    );
  }

  pos.needsUpdate = true;
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
}

function getPlateWidthInModelSpace(mesh: Mesh, model: Object3D): number {
  const pos = mesh.geometry.attributes.position;
  if (!pos) return 0;

  const original = mesh.userData[FRONT_PLATE_ORIGINAL_POSITIONS_KEY] as Float32Array | undefined;

  model.updateMatrixWorld(true);
  mesh.updateMatrixWorld(true);
  _invModel.copy(model.matrixWorld).invert();

  const box = new Box3();
  for (let i = 0; i < pos.count; i++) {
    _v.set(
      original ? original[i * 3] : pos.getX(i),
      original ? original[i * 3 + 1] : pos.getY(i),
      original ? original[i * 3 + 2] : pos.getZ(i),
    );
    _v.applyMatrix4(mesh.matrixWorld).applyMatrix4(_invModel);
    box.expandByPoint(_v);
  }

  return box.getSize(new Vector3()).x;
}

function resolvePlateDisplay(
  plateDisplay?: CarPlateDisplayTuning,
  legacy?: CarRearPlateTuning,
): CarPlateDisplayTuning | undefined {
  if (plateDisplay) return plateDisplay;
  if (!legacy) return undefined;
  return {
    sizeScale: legacy.sizeScale,
    front: { offsetX: 0, offsetY: 0, flipX: false, flipY: false },
    rear: { offsetX: 0, offsetY: legacy.offsetY, flipX: false, flipY: false },
  };
}

function resolveRearReferenceWidth(
  root: Object3D,
  config: CarPlateConfig,
  plateDisplay?: CarPlateDisplayTuning,
): number | null {
  if (config.rearPlateMeshNames?.length) {
    const rearMesh = findMesh(root, config.rearPlateMeshNames[0]);
    if (rearMesh) {
      return getPlateWidthInModelSpace(rearMesh, root);
    }
  }

  if (config.rearPlatePlane) {
    if (config.rearPlanePlacement) {
      return computeFixedPlanePlacement(root, config.rearPlanePlacement, "rear", plateDisplay).width;
    }
    const rearPlacement = computeRearPlatePlacement(
      root,
      config.rearPlacement,
      plateDisplay,
      config.rearPocketSourceMesh,
    );
    if (rearPlacement) return rearPlacement.width;
  }

  return null;
}

function resolveFrontPlateScale(
  root: Object3D,
  config: CarPlateConfig,
  plateDisplay?: CarPlateDisplayTuning,
): number {
  if (!config.matchFrontPlateToRear) {
    return config.frontPlateScale ?? 1;
  }

  const rearWidth = resolveRearReferenceWidth(root, config, plateDisplay);
  if (rearWidth == null || rearWidth <= 0) {
    return config.frontPlateScale ?? 1;
  }

  if (config.frontPlatePlane) {
    const baseWidth = computeFixedPlanePlacement(
      root,
      config.frontPlanePlacement ?? { xRatio: 0.5, yRatio: 0.2, widthRatio: 0.18 },
      "front",
      plateDisplay,
    ).width;
    if (baseWidth > 0) return rearWidth / baseWidth;
    return config.frontPlateScale ?? 1;
  }

  if (config.frontPlateMeshNames.length > 0) {
    const frontMesh = findMesh(root, config.frontPlateMeshNames[0]);
    if (frontMesh) {
      const frontWidth = getPlateWidthInModelSpace(frontMesh, root);
      if (frontWidth > 0) return rearWidth / frontWidth;
    }
  }

  return config.frontPlateScale ?? 1;
}

function applyTextureToMesh(
  mesh: Mesh,
  texture: CanvasTexture,
  scale: number,
  tuning?: CarPlateFaceTuning,
): void {
  applyFrontPlateGeometry(mesh, scale, tuning);
  normalizePlateMeshUVs(mesh.geometry);
  flipPlateUVs(mesh.geometry, tuning?.flipX ?? false, tuning?.flipY ?? false);

  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of materials) {
    if (!(mat instanceof MeshStandardMaterial)) continue;
    if (mat.map instanceof CanvasTexture) {
      mat.map.dispose();
    }
    mat.map = texture;
    mat.color = new Color(0xffffff);
    mat.metalness = 0;
    mat.roughness = 0.9;
    mat.needsUpdate = true;
  }
}

type RearPlatePlacement = {
  position: Vector3;
  width: number;
  height: number;
};

const _v = new Vector3();
const _invModel = new Matrix4();

function vertexInModelSpace(
  bodyMesh: Mesh,
  model: Object3D,
  index: number,
  target: Vector3,
): Vector3 {
  const pos = bodyMesh.geometry.attributes.position;
  _invModel.copy(model.matrixWorld).invert();
  return target
    .set(pos.getX(index), pos.getY(index), pos.getZ(index))
    .applyMatrix4(bodyMesh.matrixWorld)
    .applyMatrix4(_invModel);
}

/** Ниша под номер на крышке багажника — по bbox модели в world space (устойчиво к `<Center>`). */
function computeRearPlatePlacement(
  model: Object3D,
  placementConfig?: RearPlatePlacementConfig,
  plateDisplay?: CarPlateDisplayTuning,
  pocketSourceMesh = DEFAULT_REAR_POCKET_SOURCE_MESH,
): RearPlatePlacement | null {
  const cfg = placementConfig ?? {
    yMinRatio: 0.52,
    yMaxRatio: 0.62,
    widthFactor: 1.15,
    minWidthRatio: 0.44,
    zOffset: 0.003,
  };

  const bodyMesh = findMesh(model, pocketSourceMesh);
  if (!bodyMesh) return null;

  model.updateMatrixWorld(true);
  bodyMesh.updateMatrixWorld(true);

  const modelBox = getModelBodyBoxWorld(model);
  const modelSize = modelBox.getSize(new Vector3());
  const modelMin = modelBox.min;
  const modelCenterX = (modelBox.min.x + modelBox.max.x) * 0.5;

  const zCut = modelMin.z + modelSize.z * 0.035;
  const xLimit = modelSize.x * 0.2;
  const yMin = modelMin.y + modelSize.y * cfg.yMinRatio;
  const yMax = modelMin.y + modelSize.y * cfg.yMaxRatio;

  const pos = bodyMesh.geometry.attributes.position;
  const pocket = new Box3();

  for (let i = 0; i < pos.count; i++) {
    _v
      .set(pos.getX(i), pos.getY(i), pos.getZ(i))
      .applyMatrix4(bodyMesh.matrixWorld);
    if (
      _v.z < zCut &&
      Math.abs(_v.x - modelCenterX) < xLimit &&
      _v.y > yMin &&
      _v.y < yMax
    ) {
      pocket.expandByPoint(_v);
    }
  }

  if (pocket.isEmpty()) return null;

  const pocketSize = pocket.getSize(new Vector3());
  const fromPocket = pocketSize.x * (cfg.widthFactor ?? 1.05);
  const fromModel = modelSize.x * (cfg.minWidthRatio ?? 0.38);
  const sizeScale = plateDisplay?.sizeScale ?? 1;
  const width = Math.max(fromPocket, fromModel) * sizeScale;
  const height = width * (PLATE_SVG_HEIGHT / PLATE_SVG_WIDTH);
  const position = pocket.getCenter(new Vector3());
  position.z = pocket.min.z - (cfg.zOffset ?? 0.003);
  model.worldToLocal(position);
  position.y += (cfg.offsetY ?? 0) + (plateDisplay?.rear.offsetY ?? 0) * height * PLATE_OFFSET_SLIDER_UNIT;
  position.x += (plateDisplay?.rear.offsetX ?? 0) * width * PLATE_OFFSET_SLIDER_UNIT;

  return { position, width, height };
}

function computeFixedPlanePlacement(
  model: Object3D,
  cfg: FixedPlanePlacementConfig,
  face: "front" | "rear",
  plateDisplay?: CarPlateDisplayTuning,
): RearPlatePlacement {
  const modelBox = getModelBodyBoxLocal(model);
  const modelSize = modelBox.getSize(new Vector3());
  const sizeScale = plateDisplay?.sizeScale ?? 1;
  const width = modelSize.x * cfg.widthRatio * sizeScale;
  const height = width * (PLATE_SVG_HEIGHT / PLATE_SVG_WIDTH);
  const position = new Vector3(
    modelBox.min.x + modelSize.x * cfg.xRatio,
    modelBox.min.y + modelSize.y * cfg.yRatio,
    face === "front"
      ? modelBox.max.z + (cfg.zOffset ?? 0.003)
      : modelBox.min.z - (cfg.zOffset ?? 0.003),
  );

  const offsets = plateDisplay?.[face];
  position.y += (offsets?.offsetY ?? 0) * height * PLATE_OFFSET_SLIDER_UNIT;
  position.x += (offsets?.offsetX ?? 0) * width * PLATE_OFFSET_SLIDER_UNIT;

  return { position, width, height };
}

function disposeNamedPlate(model: Object3D, name: string): void {
  const existing = model.getObjectByName(name);
  if (!existing) return;

  existing.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry.dispose();
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats) {
      mat.dispose();
    }
  });

  model.remove(existing);
}

function disposeRearPlate(model: Object3D): void {
  disposeNamedPlate(model, REAR_PLATE_OBJECT_NAME);
}

function disposeFrontPlate(model: Object3D): void {
  disposeNamedPlate(model, FRONT_PLATE_OBJECT_NAME);
}

function applyRearPlatePlane(
  model: Object3D,
  texture: CanvasTexture,
  config: CarPlateConfig,
  plateDisplay?: CarPlateDisplayTuning,
): boolean {
  let placement: RearPlatePlacement | null = null;

  if (config.rearPlanePlacement) {
    placement = computeFixedPlanePlacement(model, config.rearPlanePlacement, "rear", plateDisplay);
  } else {
    placement = computeRearPlatePlacement(
      model,
      config.rearPlacement,
      plateDisplay,
      config.rearPocketSourceMesh,
    );
  }

  if (!placement) {
    console.warn("[CarPlate] rear plate placement not found");
    return false;
  }

  disposeRearPlate(model);

  const rearTuning = plateDisplay?.rear;
  const rearTexture = createFacePlaneTexture(texture, "rear");
  const material = createPlateMaterial(rearTexture, 0.18);
  const plane = new Mesh(new PlaneGeometry(placement.width, placement.height), material);
  plane.name = REAR_PLATE_OBJECT_NAME;
  plane.position.copy(placement.position);
  const scale = getPlaneScale("rear", rearTuning);
  plane.scale.set(scale.x, scale.y, 1);
  plane.renderOrder = 10;
  model.add(plane);
  return true;
}

function applyFrontPlatePlane(
  model: Object3D,
  texture: CanvasTexture,
  config: CarPlateConfig,
  plateDisplay?: CarPlateDisplayTuning,
  widthScale = 1,
): boolean {
  const baseCfg = config.frontPlanePlacement ?? { xRatio: 0.5, yRatio: 0.2, widthRatio: 0.18 };
  const placement = computeFixedPlanePlacement(model, baseCfg, "front", plateDisplay);
  placement.width *= widthScale;
  placement.height *= widthScale;

  disposeFrontPlate(model);

  const frontTuning = plateDisplay?.front;
  const frontTexture = createFacePlaneTexture(texture, "front");
  const material = createPlateMaterial(frontTexture);
  const plane = new Mesh(new PlaneGeometry(placement.width, placement.height), material);
  plane.name = FRONT_PLATE_OBJECT_NAME;
  plane.position.copy(placement.position);
  const scale = getPlaneScale("front", frontTuning);
  plane.scale.set(scale.x, scale.y, 1);
  plane.renderOrder = 10;
  model.add(plane);
  return true;
}

/** Накладывает ГОСТ-номер спереди (mesh) и сзади (plane). */
export async function applyCarPlateToModel(
  root: Object3D,
  parts: VehiclePlateParts,
  config: CarPlateConfig,
  plateDisplay?: CarPlateDisplayTuning,
  legacyRearTuning?: CarRearPlateTuning,
): Promise<boolean> {
  const display = resolvePlateDisplay(plateDisplay, legacyRearTuning);
  hidePlateMeshes(root, config.hiddenPlateMeshNames);
  const texture = await createPlateCanvasTexture(parts);
  let applied = false;
  const frontScale = resolveFrontPlateScale(root, config, display);

  for (const meshName of config.frontPlateMeshNames) {
    const mesh = findMesh(root, meshName);
    if (!mesh) {
      console.warn(`[CarPlate] mesh not found: ${meshName}`);
      continue;
    }
    applyTextureToMesh(mesh, texture, frontScale, display?.front);
    applied = true;
  }

  if (config.frontPlatePlane) {
    applied =
      applyFrontPlatePlane(root, texture, config, display, frontScale) || applied;
  }

  for (const meshName of config.rearPlateMeshNames ?? []) {
    const mesh = findMesh(root, meshName);
    if (!mesh) {
      console.warn(`[CarPlate] mesh not found: ${meshName}`);
      continue;
    }
    applyTextureToMesh(mesh, texture, 1, display?.rear);
    applied = true;
  }

  if (config.rearPlatePlane) {
    applied = applyRearPlatePlane(root, texture, config, display) || applied;
  }

  return applied;
}
