import type { VehiclePlateParts } from "../../api";
import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo } from "react";
import { applyBodyColor, inspectCarModel } from "./carBodyColor";
import { getCarBodyColorConfig } from "./carBodyColorConfig";
import { enhanceCarMaterials } from "./carModelMaterials";
import { resolveVehiclePlateParts } from "./carPlate";
import { primeModelBodyBox } from "./carModelBodyBox";
import { applyCarPlateToModel } from "./carPlateTexture";
import { getCarPlateConfig } from "./carPlateConfig";
import { scaleModelToTargetSize } from "./carModelFit";

import type { CarPlateDisplayTuning, CarRearPlateTuning } from "./types";

type Props = {
  modelPath: string;
  modelId?: string;
  bodyColor?: string | null;
  plate?: VehiclePlateParts | null;
  plateText?: string | null;
  layoutKey?: number;
  plateTuning?: CarPlateDisplayTuning;
  rearPlateTuning?: CarRearPlateTuning;
};

export function CarModelMesh({
  modelPath,
  modelId,
  bodyColor,
  plate,
  plateText,
  layoutKey = 0,
  plateTuning,
  rearPlateTuning,
}: Props) {
  const { scene } = useGLTF(modelPath);
  const model = useMemo(() => {
    const cloned = scene.clone(true);
    scaleModelToTargetSize(cloned);
    return cloned;
  }, [scene]);

  const parts = useMemo(
    () => resolveVehiclePlateParts(plate, plateText),
    [plate, plateText],
  );

  useLayoutEffect(() => {
    inspectCarModel(model, modelPath, modelId);
    enhanceCarMaterials(model, modelId, bodyColor);
    primeModelBodyBox(model);
  }, [model, modelPath, modelId, bodyColor]);

  useLayoutEffect(() => {
    if (!bodyColor || !modelId || modelId === "kia-k5") return;
    applyBodyColor(model, bodyColor, getCarBodyColorConfig(modelId));
  }, [model, bodyColor, modelId]);

  const plateTuningKey = useMemo(
    () => (plateTuning ? JSON.stringify(plateTuning) : ""),
    [plateTuning],
  );

  useLayoutEffect(() => {
    if (!modelId || !parts) return;
    const config = getCarPlateConfig(modelId);
    if (!config) return;

    let alive = true;

    const apply = () => {
      if (!alive) return;
      primeModelBodyBox(model);
      void applyCarPlateToModel(model, parts, config, plateTuning, rearPlateTuning);
    };

    apply();
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(apply);
    });

    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
  }, [model, modelId, parts, layoutKey, plateTuningKey, plateTuning, rearPlateTuning]);

  return <primitive object={model} />;
}

export function preloadCarModel(modelPath: string): void {
  useGLTF.preload(modelPath);
}
