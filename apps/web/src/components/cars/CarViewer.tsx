import { Center, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { PerspectiveCamera } from "three";
import { Box3, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { getCarModelPath } from "./carModelRegistry";
import { CarModelMesh, preloadCarModel } from "./CarModelMesh";
import { applyCameraFit, computeFitDistance, type ModelFitBox } from "./carModelFit";
import { applyOrbitZoomLimits, DEFAULT_MAX_ZOOM_RATIO, DEFAULT_MIN_ZOOM_RATIO } from "./carViewerZoom";
import type { CarViewerProps } from "./types";

function CarScene({
  modelPath,
  modelId,
  bodyColor,
  plate,
  plateText,
  enableZoom,
  minZoomRatio,
  maxZoomRatio,
  onZoomLimitsChange,
}: {
  modelPath: string;
  modelId: string;
  bodyColor?: string | null;
  plate?: CarViewerProps["plate"];
  plateText?: string | null;
  enableZoom: boolean;
  minZoomRatio: number;
  maxZoomRatio: number;
  onZoomLimitsChange?: CarViewerProps["onZoomLimitsChange"];
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const fitBoxRef = useRef<ModelFitBox | null>(null);
  const { camera, size } = useThree();

  const applyFit = useCallback(() => {
    const box = fitBoxRef.current;
    if (!box || box.isEmpty()) return;

    const fitDistance = computeFitDistance(box, camera as PerspectiveCamera);
    applyCameraFit(camera as PerspectiveCamera, controlsRef.current, box, fitDistance);

    if (controlsRef.current) {
      const limits = applyOrbitZoomLimits(
        controlsRef.current,
        fitDistance,
        minZoomRatio,
        maxZoomRatio,
      );
      onZoomLimitsChange?.({ ...limits, fitDistance });
    }
  }, [camera, minZoomRatio, maxZoomRatio, onZoomLimitsChange]);

  const handleCentered = useCallback(
    (data: { width: number; height: number; depth: number }) => {
      const { width, height, depth } = data;
      fitBoxRef.current = new Box3(
        new Vector3(-width / 2, -height / 2, -depth / 2),
        new Vector3(width / 2, height / 2, depth / 2),
      );
      applyFit();
    },
    [applyFit],
  );

  useLayoutEffect(() => {
    applyFit();
  }, [applyFit, size.width, size.height]);

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 3]} intensity={1.1} castShadow={false} />
      <directionalLight position={[-3, 2, -2]} intensity={0.35} />

      <Center cacheKey={modelPath} onCentered={handleCentered}>
        <CarModelMesh
          modelPath={modelPath}
          modelId={modelId}
          bodyColor={bodyColor}
          plate={plate}
          plateText={plateText}
        />
      </Center>

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[0, 0, 0]}
        enablePan={false}
        enableZoom={enableZoom}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2 - 0.05}
        rotateSpeed={0.65}
        zoomSpeed={0.8}
        touches={{
          ONE: 0,
          TWO: 2,
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
  className = "",
  height = 220,
  enableZoom = true,
  minZoomRatio = DEFAULT_MIN_ZOOM_RATIO,
  maxZoomRatio = DEFAULT_MAX_ZOOM_RATIO,
  onZoomLimitsChange,
}: CarViewerProps) {
  const modelPath = modelPathProp ?? getCarModelPath(modelId);

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
            enableZoom={enableZoom}
            minZoomRatio={minZoomRatio}
            maxZoomRatio={maxZoomRatio}
            onZoomLimitsChange={onZoomLimitsChange}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
