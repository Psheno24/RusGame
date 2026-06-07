import { Box3, Object3D, PerspectiveCamera, Sphere, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

const FIT_MARGIN = 1.25;
const TARGET_SIZE = 2;

export type ModelFit = {
  box: Box3;
  target: Vector3;
};

export type ModelFitBox = Box3;

/** Нормализует масштаб модели (центрирование — через `<Center>` в сцене). */
export function scaleModelToTargetSize(model: Object3D): void {
  model.updateMatrixWorld(true);

  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  if (maxDim > 0) {
    const scale = TARGET_SIZE / maxDim;
    model.scale.set(scale, scale, scale);
  }

  model.updateMatrixWorld(true);
}

export function computeFitDistance(
  box: Box3,
  camera: PerspectiveCamera,
  margin = FIT_MARGIN,
): number {
  const sphere = box.getBoundingSphere(new Sphere());
  const radius = sphere.radius;
  const fovRad = (camera.fov * Math.PI) / 180;
  const fitHeightDistance = radius / Math.sin(fovRad / 2);
  const fitWidthDistance = fitHeightDistance / camera.aspect;
  return margin * Math.max(fitHeightDistance, fitWidthDistance);
}

const SCENE_TARGET = new Vector3(0, 0, 0);

/** Ставит камеру и target OrbitControls на центр сцены (0,0,0 после `<Center>`). */
export function applyCameraFit(
  camera: PerspectiveCamera,
  controls: OrbitControlsImpl | null,
  box: Box3,
  fitDistance: number,
): void {
  const target = SCENE_TARGET;
  const azimuth = 0.85;
  const elevation = 0.35;
  const cosEl = Math.cos(elevation);

  camera.position.set(
    target.x + Math.sin(azimuth) * cosEl * fitDistance,
    target.y + Math.sin(elevation) * fitDistance,
    target.z + Math.cos(azimuth) * cosEl * fitDistance,
  );
  camera.lookAt(target);
  camera.updateProjectionMatrix();

  if (controls) {
    controls.target.copy(target);
    controls.update();
  }
}
