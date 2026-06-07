import { Center, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PerspectiveCamera } from "three";
import { Box3, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { mergeCardDisplayConfig } from "./carDisplayConfig";
import { getCarModelPath } from "./carModelRegistry";
import { CarModelMesh, preloadCarModel } from "./CarModelMesh";
import {
  applyCameraFit,
  computeFitDistance,
  readCameraViewState,
  type ModelFitBox,
} from "./carModelFit";
import { applyOrbitZoomLimits, DEFAULT_MAX_ZOOM_RATIO, DEFAULT_MIN_ZOOM_RATIO } from "./carViewerZoom";
import type { CarViewerProps } from "./types";

const _target = new Vector3();

function CarScene({
  modelPath,
  modelId,
  bodyColor,
  plate,
  plateText,
  plateTuning,
  rearPlateTuning,
  modelOffset,
  cardDisplay,
  lockCamera,
  enableZoom,
  minZoomRatio,
  maxZoomRatio,
  onZoomLimitsChange,
  viewStateRef,
  onViewStateChange,
}: {
  modelPath: string;
  modelId: string;
  bodyColor?: string | null;
  plate?: CarViewerProps["plate"];
  plateText?: string | null;
  plateTuning?: CarViewerProps["plateTuning"];
  rearPlateTuning?: CarViewerProps["rearPlateTuning"];
  modelOffset?: CarViewerProps["modelOffset"];
  cardDisplay?: CarViewerProps["cardDisplay"];
  lockCamera?: boolean;
  enableZoom: boolean;
  minZoomRatio: number;
  maxZoomRatio: number;
  onZoomLimitsChange?: CarViewerProps["onZoomLimitsChange"];
  viewStateRef?: CarViewerProps["viewStateRef"];
  onViewStateChange?: CarViewerProps["onViewStateChange"];
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const fitBoxRef = useRef<ModelFitBox | null>(null);
  const fitDistanceRef = useRef(1);
  const initialPoseAppliedRef = useRef(false);
  const [layoutKey, setLayoutKey] = useState(0);
  const { camera, size } = useThree();
  const viewConfig = useMemo(() => mergeCardDisplayConfig(cardDisplay), [cardDisplay]);

  const publishViewState = useCallback(() => {
    if (!viewStateRef || !controlsRef.current) return;
    const state = readCameraViewState(
      camera as PerspectiveCamera,
      controlsRef.current,
      fitDistanceRef.current,
    );
    viewStateRef.current = {
      ...state,
      fitDistance: fitDistanceRef.current,
      modelOffsetX: modelOffset?.x ?? viewConfig.modelOffsetX,
      modelOffsetY: modelOffset?.y ?? viewConfig.modelOffsetY,
      modelOffsetZ: modelOffset?.z ?? viewConfig.modelOffsetZ,
    };
    onViewStateChange?.(viewStateRef.current);
  }, [camera, modelOffset, onViewStateChange, viewConfig, viewStateRef]);

  const applyFit = useCallback(() => {
    const box = fitBoxRef.current;
    if (!box || box.isEmpty()) return;

    const fitDistance = computeFitDistance(box, camera as PerspectiveCamera);
    fitDistanceRef.current = fitDistance;

    const shouldApplyPose = lockCamera || !initialPoseAppliedRef.current;
    if (shouldApplyPose) {
      _target.set(viewConfig.targetX, viewConfig.targetY, viewConfig.targetZ);
      applyCameraFit(camera as PerspectiveCamera, controlsRef.current, box, fitDistance, {
        azimuth: viewConfig.azimuth,
        elevation: viewConfig.elevation,
        distanceRatio: viewConfig.distanceRatio,
        target: _target,
      });
      initialPoseAppliedRef.current = true;
    }

    if (controlsRef.current) {
      const limits = applyOrbitZoomLimits(
        controlsRef.current,
        fitDistance,
        minZoomRatio,
        maxZoomRatio,
      );
      onZoomLimitsChange?.({ ...limits, fitDistance });
    }

    publishViewState();
  }, [
    camera,
    lockCamera,
    minZoomRatio,
    maxZoomRatio,
    onZoomLimitsChange,
    publishViewState,
    viewConfig,
  ]);

  useEffect(() => {
    initialPoseAppliedRef.current = false;
  }, [modelPath, cardDisplay?.azimuth, cardDisplay?.elevation, cardDisplay?.distanceRatio, lockCamera]);

  const handleCentered = useCallback(
    (data: { width: number; height: number; depth: number }) => {
      const { width, height, depth } = data;
      fitBoxRef.current = new Box3(
        new Vector3(-width / 2, -height / 2, -depth / 2),
        new Vector3(width / 2, height / 2, depth / 2),
      );
      setLayoutKey((k) => k + 1);
      applyFit();
    },
    [applyFit],
  );

  useLayoutEffect(() => {
    applyFit();
  }, [applyFit, size.width, size.height]);

  const offset = modelOffset ?? {
    x: viewConfig.modelOffsetX,
    y: viewConfig.modelOffsetY,
    z: viewConfig.modelOffsetZ,
  };

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 3]} intensity={1.1} castShadow={false} />
      <directionalLight position={[-3, 2, -2]} intensity={0.35} />

      <group position={[offset.x, offset.y, offset.z]}>
        <Center cacheKey={modelPath} onCentered={handleCentered}>
          <CarModelMesh
            modelPath={modelPath}
            modelId={modelId}
            bodyColor={bodyColor}
            plate={plate}
            plateText={plateText}
            plateTuning={plateTuning}
            rearPlateTuning={rearPlateTuning}
            layoutKey={layoutKey}
          />
        </Center>
      </group>

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[viewConfig.targetX, viewConfig.targetY, viewConfig.targetZ]}
        enablePan={false}
        enableRotate={!lockCamera}
        enableZoom={enableZoom && !lockCamera}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2 - 0.05}
        rotateSpeed={0.65}
        zoomSpeed={0.8}
        onChange={publishViewState}
        touches={{
          ONE: lockCamera ? undefined : 0,
          TWO: lockCamera ? undefined : 2,
        }}
      />
    </>
  );
}

export function CarViewer({
  modelId,
  modelPath: modelPathProp,
  bodyColor,
  plate,
  plateText,
  plateTuning,
  rearPlateTuning,
  modelOffset,
  cardDisplay,
  lockCamera = false,
  viewStateRef,
  onViewStateChange,
  className = "",
  height = 220,
  enableZoom = true,
  minZoomRatio = DEFAULT_MIN_ZOOM_RATIO,
  maxZoomRatio = DEFAULT_MAX_ZOOM_RATIO,
  onZoomLimitsChange,
}: CarViewerProps) {
  const modelPath = modelPathProp ?? getCarModelPath(modelId);
  const shouldLock = lockCamera || Boolean(cardDisplay?.fixed);

  useEffect(() => {
    preloadCarModel(modelPath);
  }, [modelPath]);

  const rootClass = ["car-viewer", className].filter(Boolean).join(" ");
  const style = { height: typeof height === "number" ? `${height}px` : height };

  return (
    <div className={rootClass} style={style}>
      <Canvas
        className="car-viewer__canvas"
        camera={{ fov: 42, near: 0.1, far: 100, position: [3, 1.2, 4] }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <CarScene
            modelPath={modelPath}
            modelId={modelId}
            bodyColor={bodyColor}
            plate={plate}
            plateText={plateText}
            plateTuning={plateTuning}
            rearPlateTuning={rearPlateTuning}
            modelOffset={modelOffset}
            cardDisplay={cardDisplay}
            lockCamera={shouldLock}
            enableZoom={enableZoom}
            minZoomRatio={minZoomRatio}
            maxZoomRatio={maxZoomRatio}
            onZoomLimitsChange={onZoomLimitsChange}
            viewStateRef={viewStateRef}
            onViewStateChange={onViewStateChange}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
