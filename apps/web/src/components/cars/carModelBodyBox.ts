import { Box3, Matrix4, Mesh, Object3D, Vector3 } from "three";

const REAR_PLATE_OBJECT_NAME = "__car_rear_plate__";
const FRONT_PLATE_OBJECT_NAME = "__car_front_plate__";
const BODY_BOX_WORLD_KEY = "__car_body_box_world__";
const BODY_BOX_LOCAL_KEY = "__car_body_box__";

const _childBox = new Box3();
const _corner = new Vector3();
const _v = new Vector3();
const _invModel = new Matrix4();

function isPlateMesh(child: Object3D): boolean {
  return child.name === REAR_PLATE_OBJECT_NAME || child.name === FRONT_PLATE_OBJECT_NAME;
}

/** Мелкие детали на краю силуэта (K5 mesh_76) не должны сдвигать bbox номера. */
function isBodyBoxEdgeOutlier(meshBox: Box3, roughBox: Box3): boolean {
  const meshSize = meshBox.getSize(_v);
  const roughSize = roughBox.getSize(new Vector3());
  const meshCenter = meshBox.getCenter(new Vector3());
  const maxMeshDim = Math.max(meshSize.x, meshSize.y, meshSize.z);
  if (maxMeshDim > roughSize.x * 0.12) return false;

  const margin = 0.08;
  const outsideX =
    meshCenter.x < roughBox.min.x + roughSize.x * margin ||
    meshCenter.x > roughBox.max.x - roughSize.x * margin;
  const outsideZ =
    meshCenter.z < roughBox.min.z + roughSize.z * margin ||
    meshCenter.z > roughBox.max.z - roughSize.z * margin;
  return outsideX || outsideZ;
}

/** Bbox кузова в world space; не включает плоскости номеров. */
export function computeModelBodyBoxWorld(model: Object3D): Box3 {
  model.updateMatrixWorld(true);

  const rough = new Box3();
  model.traverse((child) => {
    if (isPlateMesh(child)) return;
    if (!(child instanceof Mesh) || !child.visible) return;
    _childBox.setFromObject(child);
    if (!_childBox.isEmpty()) rough.union(_childBox);
  });

  const worldBox = new Box3();
  model.traverse((child) => {
    if (isPlateMesh(child)) return;
    if (!(child instanceof Mesh) || !child.visible) return;
    _childBox.setFromObject(child);
    if (_childBox.isEmpty()) return;
    if (isBodyBoxEdgeOutlier(_childBox, rough)) return;
    worldBox.union(_childBox);
  });

  if (worldBox.isEmpty()) {
    worldBox.setFromObject(model);
  }

  return worldBox;
}

function worldBoxToModelLocal(worldBox: Box3, model: Object3D): Box3 {
  _invModel.copy(model.matrixWorld).invert();
  const local = new Box3();
  const { min, max } = worldBox;
  for (const x of [min.x, max.x]) {
    for (const y of [min.y, max.y]) {
      for (const z of [min.z, max.z]) {
        local.expandByPoint(_corner.set(x, y, z).applyMatrix4(_invModel));
      }
    }
  }
  return local;
}

export function clearModelBodyBoxCache(model: Object3D): void {
  delete model.userData[BODY_BOX_WORLD_KEY];
  delete model.userData[BODY_BOX_LOCAL_KEY];
}

export function getModelBodyBoxWorld(model: Object3D): Box3 {
  const cached = model.userData[BODY_BOX_WORLD_KEY] as Box3 | undefined;
  if (cached) return cached;

  const world = computeModelBodyBoxWorld(model);
  model.userData[BODY_BOX_WORLD_KEY] = world.clone();
  return model.userData[BODY_BOX_WORLD_KEY] as Box3;
}

/** Bbox кузова в локальных координатах корня модели. */
export function getModelBodyBoxLocal(model: Object3D): Box3 {
  const cached = model.userData[BODY_BOX_LOCAL_KEY] as Box3 | undefined;
  if (cached) return cached;

  const local = worldBoxToModelLocal(getModelBodyBoxWorld(model), model);
  model.userData[BODY_BOX_LOCAL_KEY] = local.clone();
  return model.userData[BODY_BOX_LOCAL_KEY] as Box3;
}

/** Зафиксировать bbox до добавления номеров (после enhanceCarMaterials и перед applyCarPlate). */
export function primeModelBodyBox(model: Object3D): void {
  clearModelBodyBoxCache(model);
  getModelBodyBoxWorld(model);
  getModelBodyBoxLocal(model);
}

export function getModelUniformScale(model: Object3D): number {
  return model.scale.x || 1;
}
