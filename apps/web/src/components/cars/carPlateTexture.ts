import {
  BufferGeometry,
  CanvasTexture,
  Color,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SRGBColorSpace,
} from "three";
import type { VehiclePlateParts } from "../../api";
import { drawPlateToCanvas, PLATE_SVG_HEIGHT, PLATE_SVG_WIDTH } from "../../plateSvgMarkup";
import type { CarPlateConfig } from "./carPlateConfig";

const PLATE_FONT_URL = "/fonts/gost-plate.ttf";
const TEXTURE_SCALE = 2;

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
      // fallback fonts in SVG
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

function applyTextureToMesh(mesh: Mesh, texture: CanvasTexture): void {
  normalizePlateMeshUVs(mesh.geometry);

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

/** Заменяет запечённый номер на mesh плашки (Index_0_1_BD_2 у Camry). */
export async function applyCarPlateToModel(
  root: Object3D,
  parts: VehiclePlateParts,
  config: CarPlateConfig,
): Promise<boolean> {
  const mesh = findMesh(root, config.plateMeshName);
  if (!mesh) {
    console.warn(`[CarPlate] mesh not found: ${config.plateMeshName}`);
    return false;
  }

  const texture = await createPlateCanvasTexture(parts);
  applyTextureToMesh(mesh, texture);
  return true;
}
